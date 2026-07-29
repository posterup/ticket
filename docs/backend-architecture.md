# Backend Architecture

This document describes the backend of **پوستر (Poster)**. For the tech stack
and cross-cutting conventions, see `CLAUDE.md`.

## Frontend / backend separation

The App Router lets frontend and backend live in one Next.js project while
staying cleanly separated by directory:

- **Frontend** — React Server/Client Components under `app/` and `components/`.
- **Backend** — four server-only concerns, none of which import UI:
  - `types/` — the shared domain model, also consumed by the frontend for
    type-safety across the wire.
  - `prisma/` — the schema, migrations and seed fixtures.
  - `lib/server/` — the data-access layer over Postgres.
  - `app/api/**/route.ts` — HTTP Route Handlers.

Data flows one way: `route handler → lib/server → Prisma`. Handlers parse,
validate and authorize; the data-access functions own the business logic.

## Layout

```
prisma/
  schema.prisma     # the datastore
  seed.ts           # loads seed-data.ts, preserving every fixture id
  seed-data.ts      # the hand-authored fixtures

lib/server/
  db.ts             # Prisma client singleton, created lazily
  http.ts           # HttpError, ok/fail, readJson/readQuery, handler
  schemas/          # zod request schemas, one file per domain
  mappers/          # database rows → domain types (the only conversion point)
  auth/             # session.ts, otp.ts, guards.ts, permissions.ts
  payments/         # gateway.ts, mock.ts, zarinpal.ts, zarinpal-codes.ts
  events.ts tickets.ts orders.ts discounts/ attendees.ts guests.ts
  registrations.ts collaborators.ts workspaces.ts campaigns.ts
  engagement.ts engagement-user.ts checkins.ts finance.ts users.ts
```

## Conventions

**Every `lib/server` export is async**, and "not found" is `undefined`, never
`null`.

**Rows never leave `lib/server`.** `lib/server/mappers/` is the only place a
`DateTime` becomes an ISO string and a Prisma `SCREAMING_CASE` enum becomes the
hyphenated union in `types/` (`one-time`, `early-bird`, `checked-in`). That is
what keeps `types/` — and the wire contract — stable while storage changes
underneath. `mappers/enums.ts` declares each map as
`Record<DomainUnion, PrismaEnum>`, so adding a member to one side without the
other is a compile error.

**Money is an integer `Int` in Toman** end to end. Dates are `DateTime` in the
database and ISO 8601 strings on the wire.

**The Prisma client is created lazily**, behind a proxy: importing `lib/server`
must not require a database, because the production build traces these modules
and tests import them without querying. A missing `DATABASE_URL` fails at the
first query, not at module load.

### Route handlers

Handlers use the shared plumbing rather than building responses by hand:

```ts
export const POST = handler(async (request: Request) => {
  const input = await readJson(request, createEventSchema);
  const { user } = await requireWorkspaceAccess(input.workspaceId, "event:create");
  return ok(await createEvent({ ...input, workspaceId }), 201);
});
```

`handler()` converts a thrown `HttpError` into the envelope and anything
unexpected into a `500 INTERNAL`, so no handler writes a status code twice.

> A route file may export **only** route handlers. A shared helper exported
> from one type-checks cleanly and fails the build.

### API envelope

```ts
// success
{ "data": T }
// error
{ "error": { "message": string, "code": string, "details"?: [{ path, message }] } }
```

Error codes: `INVALID_JSON`, `INVALID_BODY`, `INVALID_QUERY`, `NOT_FOUND`,
`DUPLICATE`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_A_MANAGER`, `RATE_LIMITED`,
`CONFLICT`, `SOLD_OUT`, `SALES_CLOSED`, `PAYMENT_FAILED`, `SMS_FAILED`,
`INTERNAL`.

## Identity and authorization

**There is no role column on `User`.** Holding any `WorkspaceMember` row is what
makes someone an event manager, so a normal user becomes an organizer with a
single insert and no migration. A manager is also a normal user — they buy
tickets and follow pages like anyone else.

Sign-in is **phone OTP for both roles**. Sessions are opaque tokens: the raw
token lives only in the cookie, the database stores its SHA-256, and the row can
be revoked. One-time codes are HMAC'd with `AUTH_SECRET` as a pepper.

`middleware.ts` checks **cookie presence only** — Prisma does not run on Edge,
and a query per navigation would tax every request. The real checks are one
layer down and non-bypassable: `requireManagerPage()` in each dashboard page,
and a guard in each route handler.

> Layouts and pages render **in parallel**, so a redirect in a layout cannot
> stop the page beneath it from rendering and streaming its data. Dashboard
> pages therefore gate individually; the layout gate is defence in depth.

`lib/server/auth/permissions.ts` holds the grant table as **pure functions**, so
the whole matrix is unit-tested without a database. Two sources can grant access
to an event — a workspace membership and an accepted collaborator invite — and a
caller gets the union.

| Source | Event permissions |
| --- | --- |
| workspace `owner` | all |
| workspace `admin` | all except `event:delete` |
| workspace `staff` | `event:read`, `checkin:perform`, `attendees:read` |
| collaborator `co-host` | edit / tickets / discounts / guests / registrations / checkin |
| collaborator `checkin` | `event:read`, `checkin:perform` |
| anyone else | `event:read`, only when published and publicly visible |

A co-host cannot `collaborators:manage` — inviting further co-hosts would let
them launder their own access into new grants. `finance:withdraw` is
workspace-scoped and owner-only, never reachable through an event.

**Only accepted invites with a resolved invitee grant anything.** An invite sent
to a phone number is a display record until the person holding it accepts, which
is what makes it safe to invite someone who has not signed up.

## Orders and payments

Seats are reserved when the order is created, not when payment verifies —
otherwise two buyers reach the gateway for the last seat and one pays for
something unfulfillable. The reservation is one conditional statement, so the
capacity check and the increment cannot interleave:

```sql
UPDATE "TicketType" SET reserved = reserved + $qty
 WHERE id = $id AND sold + reserved + $qty <= capacity
```

Multi-line orders reserve in ticket-type id order so two of them cannot deadlock
on opposite lock sequences, and a partial hold is rolled back if a later line is
sold out.

```
PENDING_PAYMENT ──verify ok──► PAID ──refund──► REFUNDED
   ├─ Status=NOK / verify fail ► FAILED     (inventory released)
   ├─ user cancels ────────────► CANCELLED  (inventory released)
   └─ expiresAt passes ────────► EXPIRED    (released by a lazy sweep)
```

Settlement is idempotent by construction — the transition is a conditional
`UPDATE`, so a duplicate callback finds nothing to change and returns the
existing tickets. On settlement the buyer is upserted as a CRM contact and the
discount redemption is recorded.

Free orders skip the gateway entirely. Expired holds are swept at the top of
`createOrder` rather than by a cron, since serverless has no long-lived process.

`PAYMENT_PROVIDER` selects the gateway and defaults to `mock`, which settles
in-process so the whole loop works with no credentials. Zarinpal reads `amount`
in **Rial** unless `currency: "IRT"` is sent; conversion happens exactly once,
inside the adapter. Verify code `101` means *already verified* and is a success.

## API endpoints

52 endpoints across 40 route files. Every one is exercised by
`tests/api/*.test.ts`.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/otp/request`, `POST /api/auth/otp/verify`, `POST /api/auth/register`, `POST /api/auth/logout`, `GET /api/auth/me` |
| Events | `GET`/`POST /api/events`, `GET`/`PATCH`/`DELETE /api/events/{id}`, `PATCH /api/events/{id}/venue`, `POST /api/events/{id}/sessions`, `PATCH /api/events/{id}/sessions/{sessionId}` |
| Tickets | `GET`/`POST /api/tickets`, `PATCH /api/tickets/{id}` |
| Discounts | `GET`/`POST /api/discounts`, `POST /api/discounts/validate` |
| Guests | `GET`/`POST /api/events/{id}/guests`, `PATCH`/`DELETE /api/events/{id}/guests/{guestId}` |
| Registrations | `GET`/`POST /api/events/{id}/registrations`, `PATCH /api/events/{id}/registrations/{registrationId}` |
| Collaborators | `GET`/`POST /api/events/{id}/collaborators`, `PATCH`/`DELETE /api/events/{id}/collaborators/{collabId}` |
| Orders | `POST /api/orders`, `POST /api/orders/{id}/pay`, `POST /api/orders/{id}/cancel`, `GET /api/payments/callback` |
| Attendee | `PATCH /api/me`, `GET /api/me/{orders,tickets,bookmarks,following,feed,invites}`, `PUT /api/events/{id}/bookmark`, `POST`/`DELETE /api/events/{id}/notify`, `POST`/`DELETE /api/workspaces/{slug}/follow` |
| CRM & ops | `PATCH /api/attendees/{id}`, `POST /api/checkin`, `POST /api/sms/send` |
| Finance | `GET /api/workspaces/{slug}/finance`, `POST /api/workspaces/{slug}/bank-accounts`, `POST /api/workspaces/{slug}/withdrawals` |

`GET /api/events` and `GET /api/tickets?eventId=` are the only organiser-adjacent
reads open to anonymous callers, and both are filtered to published, publicly
visible events — the public event page depends on them.

## Testing

`npm test` runs without a database: suites that need one skip themselves, so a
fresh clone stays green. With `DATABASE_URL` set they all run — seed the
database first, since they assert against the fixtures.

Suites share one database and run sequentially (`fileParallelism: false`).
Anything that accumulates state — grants, check-ins, orders, discount codes —
must create its own fixtures or clear its own history, or it will pass alone and
fail in a full run.

`tests/setup/cookies.ts` installs a cookie jar so handlers called in-process can
resolve a session; the helpers mint **real** sessions through `createSession`,
so guards behave exactly as they do for a browser.

## Known limits

- Refunds have a status but no endpoint; withdrawals are recorded, not paid out.
- The Zarinpal adapter itself is unverified against the live gateway — its pure
  amount and response-code helpers are tested, the HTTP calls are not.
- Notifications are subscribed to but nothing sends them yet.
