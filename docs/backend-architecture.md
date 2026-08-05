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

Two gates run inside `createOrder` besides capacity: an **approval-required**
event refuses any order without an accepted registration for the buyer's phone,
and releasing inventory (expiry, cancel, gateway failure) notifies the front of
the event's **waitlist** in arrival order. Both are fire-and-forget and never
throw — the money has already moved by the time they run.

SMS goes through a gateway contract (`lib/server/sms/`) with **Kavenegar** and
**sms.ir** behind it; `SMS_PROVIDER` selects, and unset auto-detects whichever
credentials exist. A paid order messages the buyer and the event's owners and
admins.

`PAYMENT_PROVIDER` selects the gateway and defaults to `mock`, which settles
in-process so the whole loop works with no credentials. Zarinpal reads `amount`
in **Rial** unless `currency: "IRT"` is sent; conversion happens exactly once,
inside the adapter. Verify code `101` means *already verified* and is a success.

## API endpoints

78 endpoints across 62 route files. 50 of the 62 route files are exercised by
`tests/api/*.test.ts`. The 12 without direct coverage are listed in **Known
limits** — the claim used to be "every one", which was not true.

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
| Seat maps | `GET /api/layouts/{versionId}/overview`, `GET /api/layouts/{versionId}/sections/{key}/seats`, `GET /api/sessions/{id}`, `GET /api/sessions/{id}/availability`, `GET /api/sessions/{id}/sections/{key}/status`, `GET`/`POST`/`DELETE /api/sessions/{id}/holds`, `POST /api/sessions/{id}/best-available` |
| Waitlist | `GET`/`POST`/`DELETE /api/events/{id}/waitlist` — `?phone=` reads one caller's own place and is public; without it the queue is organiser-only |
| Seat-map assignment | `GET`/`PATCH /api/events/{id}/seatmap` — an organiser adopts a published layout for their own venue and prices its sections. Refused once a seat is sold or held. |
| Admin (staff) | `GET /api/admin/venues`, `GET`/`PATCH /api/admin/venues/{venueId}/layout`, `POST /api/admin/venues/{venueId}/layout/publish` |
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

Seat maps split geometry from availability across separate endpoints: geometry
is addressed by layout version and served `immutable`, availability is tiny and
short-lived. Detail: `docs/venue-architecture.md`.

## Known limits

- Route files with no direct test. Most are thin reads over `lib/server`
  functions that *are* covered, but they are untested as endpoints:
  `/events/[id]/dashboard`
  `/events/[id]/holders`
  `/events/[id]/page-data`
  `/events/discover`
  `/me/tags`
  `/me/workspaces`
  `/orders/by-code/[code]`
  `/workspaces/[slug]/attendees`
  `/workspaces/[slug]/campaigns`
  `/workspaces/[slug]/events`
  `/workspaces/[slug]`
  `/workspaces`

- `/me/tickets` shows the entry token as text, not a scannable QR — there is no
  QR encoder and no camera-based scanner in the codebase. See
  `docs/venue-architecture.md` §14.
- Refunds have a status but no endpoint; withdrawals are recorded, not paid out.
- The Zarinpal adapter itself is unverified against the live gateway — its pure
  amount and response-code helpers are tested, the HTTP calls are not.
- Notifications are subscribed to but nothing sends them yet.

## Tickets at the door

A ticket carries a `qrToken` — 43 characters of base64url from `randomBytes(32)`.
It is the bearer credential: whoever presents it is admitted, so it is never
logged and never put in a URL.

**Rendering.** `components/tickets/TicketQr.tsx` draws the code on the client
from the token already in the page. A QR fetched from an API is a ticket that
fails in a basement with no signal, which is the one place a ticket has to work.
The encoder is dynamically imported, so only an opened ticket pays for it.

**Scanning.** `components/checkin/QrScanner.tsx` uses the browser's native
`BarcodeDetector` rather than shipping a WASM decoder — the door device is
already the bottleneck. Where it is absent (desktop Safari, Firefox) the panel's
typed entry is unchanged, so check-in never depends on the camera.

**Matching.** `lib/checkin/resolve.ts` is the one place that turns a scanned or
typed string into a holder. The two are matched differently on purpose: the
short order code is case-insensitive because a human types it; the `qrToken` is
compared exactly, because base64url is case-significant and upper-casing it —
which the panel previously did to every input — turns a valid ticket into one
that does not exist.

Scanning decides nothing. The unique constraint on the `CheckIn` row is still
what prevents a second admission; a duplicate scan is refused by the server and
reported, not swallowed at the door.


## Refunds

`REFUNDED` existed on `OrderStatus` and `TicketStatus` from the first schema and
nothing ever set either one. Check-in even *refused* refunded tickets — a guard
for a state the system could not reach. Cancellation notices made that
untenable: the platform was texting buyers that their money would come back with
no way to record that it had.

**The money is manual.** Iranian gateways settle to the organiser, not to the
platform, so nothing here moves rials. `lib/server/refunds.ts` owns the
*consequences*, as the exact inverse of `markOrderPaid` and in the same order:
`sold` decremented, tickets set `REFUNDED`, `SeatStatus` rows deleted so the
seat is genuinely back on sale, order set `REFUNDED`, waitlist notified, buyer
texted.

Refuses anything not `PAID` — refunding twice would decrement `sold` again and
corrupt every capacity figure derived from it. Tickets are voided rather than
deleted so the `qrToken` still resolves at the door to "this ticket is void",
which beats "unknown code" for someone holding a phone.

| Endpoint | Behaviour |
| --- | --- |
| `POST /api/orders/{id}/refund` | Organiser-only (`event:edit`). Unwinds one paid order. |
| `GET /api/events/{id}/refunds` | `{ orders, reach }` — the worklist, and how many people a cancellation would text. |

`reach` and `orders` share one response because they answer the same question at
two moments: before cancelling ("this will text 214 people") and after ("here is
who you owe").


## Ticket design («قالب بلیت»)

The designer shipped on the event dashboard with **no persistence of any kind**.
Its save button set a React boolean and rendered «ذخیره شد» over a template that
was dropped on reload; `ticketDesign` was not in the schema, no route wrote it,
and the buyer's ticket never read it. An organiser could style a ticket, be told
it was saved, and have none of it happen.

`Event.ticketDesign Json?` now stores it — one document, read and written whole
by the designer and never queried into. Replaced rather than merged: the
designer always sends the complete template, and a merge would make "clear the
logo" impossible to express.

It travels to the buyer on `IssuedTicket.design`, so `/me/tickets` renders the
ticket that was designed rather than a generic one. `TicketPreview` now draws a
real scannable code whenever it is given a `qrToken`; its hardcoded decorative
grid remains only for the designer's own preview, where no ticket exists yet.

Validated by `ticketDesignSchema`: colours must be `#rrggbb` because they are
interpolated into a style attribute, and images must be `data:` URLs under
500 KB because the whole document is re-serialised on every read of the event.


## Which showing an order is for

`createOrder` took `sessionId` from the request body and wrote it to the order
without checking anything about it. Three holes, all confirmed against a running
database before being closed:

1. **A session belonging to a different event was accepted.** The order was
   filed against a showing it had nothing to do with, which then poisoned every
   query scoped by session — the check-in holder list, the refund queue, the
   cancellation notice.
2. **A cancelled session was accepted.** People could buy tickets to a show that
   had been called off, and because they bought *after* the cancellation SMS
   went out, they would never be told.
3. **`availability` was ignored.** «تکمیل ظرفیت» and «به زودی» were written by
   the dashboard and read by nothing, so an organiser's decision to stop selling
   had no effect anywhere.

All three are now refused in `createOrder`, and again in `holdSeats` and
`findBestAvailable` — seat holds are a separate way in, and letting someone take
a seat in a closed showing wastes twenty minutes of inventory before telling
them no at the worst moment.

`almost-full` stays buyable. It is an urgency hint an organiser sets to sell
*faster*; treating it as a stop would invert its meaning. The checkout session
picker now disables the closed ones and shows their label, so a buyer learns
this before filling in a form rather than after.


## Money after a refund

`computeFinance` computed `net = gross - fee - refunds`, where `gross` summed
orders with status `PAID`. A refunded order is no longer `PAID`, so it had
*already* left `gross` — subtracting `refunds` again debited the organiser
twice. Measured against the live database: refunding ۲۰۰٬۰۠۰۰ moved the payable
balance by ۳۹۴٬۰۰۰.

The bug was unreachable for as long as nothing could set `REFUNDED`, which is
why it survived; it went live the moment refunds shipped. Now:

```
kept   = Σ PAID
refunds = Σ REFUNDED
gross  = kept + refunds     // everything that ever came through the door
fee    = kept × 3%          // no commission on money handed back
net    = kept − fee
```

Refunding ۱۰۰٬۰۰۰ now moves `net` by ۹۷٬۰۰۰ — the refund, less the commission
the organiser is no longer paying on it — and leaves `gross` untouched.

## Payouts

`Withdrawal.settledAt` was never written and no code path moved a row off
`"pending"`. An organiser could request a payout; the funds were correctly
withheld from their spendable balance and then sat in a state with no exit.
Tellingly, `computeFinance` already excluded `"failed"` payouts from committed
funds — defending against a state the `WithdrawalStatus` union said could not
exist.

`/admin/payouts` is the queue, staff-only because it carries every organiser's
IBAN and account holder. It moves no money: the transfer is a bank action taken
outside the product, and what is recorded here is that it happened.

| From | May become |
| --- | --- |
| `pending` | `processing`, `paid`, `failed` |
| `processing` | `paid`, `failed` |
| `paid` | — terminal |
| `failed` | — terminal |

Terminal means terminal: a double-click cannot re-settle a transfer, and a
payout that turns out to be wrong is a new transaction rather than an edit of
the old one. `failed` releases the amount *and its fee* back into the
organiser's spendable balance.


## A cancelled show, from the buyer's side

Cancelling a سانس sends an SMS and touches nothing else. That is correct —
tickets stay `ISSUED` because the *refund* is what voids them, and that happens
later, by hand — but it left the buyer's side telling a lie: `/me/tickets`
reported «معتبر» over a scannable code, and the door admitted people to a show
that was not running.

An SMS is not sufficient on its own. It can be missed, deleted, or sent to a
phone the buyer no longer carries; the app has to say it too.

`IssuedTicket.showCancelled` is true when the session is cancelled *or* the
whole event is. It is deliberately separate from `status`, which describes the
ticket rather than the show. With it set:

- the ticket badge reads «لغو شده» and the QR is not offered — a code for a
  cancelled show only sends someone to a door that is not opening;
- the order page (the thing people print) shows the same notice in place of the
  code;
- `setCheckinByToken` refuses with «این برنامه لغو شده است» rather than
  admitting, and rather than the meaningless "unknown code".

## Test fixtures

Two failure modes bit repeatedly and are worth stating.

**Deleting an order does not restore inventory.** `sold`/`reserved` are
denormalised counters that `createOrder`/`markOrderPaid` move; a suite that
builds orders and deletes the rows leaves the numbers permanently higher. This
had pushed «بلیت زودهنگام» from a seeded `sold: 60` to its 200 capacity, at
which point unrelated suites began failing with `SOLD_OUT`. Use
`restoreInventory()` from `tests/api/helpers.ts` *before* deleting.

**`findFirst` without `orderBy` is not deterministic.** Fixture selection that
picks "a published event" or "a seated session" can draw a different row per
run, so a suite passes or fails on which one it happened to get — a
approval-gated event, or a 236-seat section when the test uses seat 300. Order
the query and constrain it to what the test actually needs.


## Who gets told, and when

Every message the platform sends, and the transition that sends it. All of them
live under `lib/server/notifications/`, all of them **never throw** — a slow SMS
operator must not turn a paid order or a published event into a 500 — and all of
them fire on a *transition*, never on a re-save, because a dashboard form
submits the same state repeatedly.

| Moment | Buyer / guest | Organiser |
| --- | --- | --- |
| Order settles | tickets issued, seats, tracking code | new sale, buyer, total |
| Inventory frees up | waitlist, in queue order | — |
| سانس or event cancelled | show is off, refund coming | — (they did it) |
| Refund recorded | amount and tracking code | — |
| Event published | «خبرم کن» subscribers | — |
| Request to attend | — | who, how many, go and decide |
| Request accepted/rejected | the answer, and how to finish | — |
| Invited to co-host | the invitee, or their workspace's owners | — |
| Sign-in | OTP | — |

Two of these were promises the platform was already making and not keeping.

**`NotifySubscription` was write-only.** Tapping «خبرم کن» stored a row and
`listNotifiedEventIds` read it straight back to light the toggle — nothing ever
sent anybody anything. The subscription existed only to remember that a promise
had been made. It now fires on the `DRAFT → PUBLISHED` transition.

**Approval decisions were silent.** A guest requested a place at an invite-only
event and waited; the organiser accepted or rejected, and the answer lived only
in a dashboard the guest cannot see. Both directions are covered now — the
organiser learns a request is waiting, the guest learns the outcome. Resetting a
decision to `pending` deliberately says nothing: that is an organiser correcting
themselves, and "your request is being reconsidered" is not news anyone can act
on.

**A collaboration invite was silent too.** `/api/me/invites` and the dashboard's
«دعوت‌ها» panel both require the invitee to think of looking, and an invitation
nobody knows about is an event with one fewer host at the door. The two channels
reach different people: a **phone** invite names a number and that person may
have no account at all, so the text is the only way to them; a **workspace**
invite is addressed to an organisation, which has no phone — its owners and
admins do. The message names the role it is actually offering, because
«ورودی و پذیرش» grants the door and nothing else and calling that co-host would
misrepresent the ask.


## Discount scope

Two holes, both in the *lookup* rather than the rules — which is why reading
`checkDiscountEligibility` alone would never have found them.

**Any workspace's code worked on any event.** Codes are unique per workspace and
the lookup was `findFirst({ where: { code } })`. Combined with `eventId: null`
meaning "every event of the workspace", that made every workspace-wide code
valid platform-wide. Confirmed against the running database: a 50% code issued
by one organiser took ۲۵۰٬۰۰۰ to ۱۲۵٬۰۰۰ on another organiser's ticket — funded
by them, and consuming the issuer's redemption count to do it. Both lookups now
scope to the event's workspace.

**`sessionId` was never checked.** The dashboard pins a code to one سانس, stores
it, and displays it back as «یک سانس»; nothing read it, so a code meant for a
quiet Tuesday worked on the sold-out Friday. A سانس-scoped code is now refused
on any other showing, and on an order that names none — the organiser said
"this showing", and an order without one is not it.

Preview takes `sessionId` too. Preview and submit applying different rules is
how a buyer is told «اعمال شد» and then refused at the moment they pay; for the
same reason, changing سانس in checkout clears an applied code.

Two existing tests failed on the fix, and both had encoded the bug. One was
named "applies an org-wide code to any event" and asserted it against an event
the file's own comment identifies as belonging to a different workspace. The
schema comment — *"Null scopes the code to every event of the workspace"* — was
right all along; the tests were not.


### Tenant scoping, swept

The cross-workspace discount bug suggested a class, so every lookup on a
workspace-owned model was checked. Most `findUnique({ where: { id } })` calls are
fine — the guard decides access, not the query, and `/api/attendees/:id` does
exactly the right thing: read the row's `workspaceId`, then
`requireWorkspaceAccess` on it.

Three more real ones in the same file:

- **`listDiscounts` returned every workspace's org-wide codes.** An organiser
  opening their own event's discounts saw rival workspaces' code strings,
  values and redemption counts. Verified by planting a 70%-off code in another
  workspace and reading it straight back. Now scoped to the event's owner.
- **`createDiscount` assigned org-wide codes to "the first workspace"** — its own
  comment said ownership would come from the session "once auth lands", and it
  had. The code was neither the creator's nor useful to them.
- **The duplicate check scanned every code on the platform**, so one organiser
  could block a name another wanted, and the 409 leaked that the name was in use
  somewhere. Uniqueness is per workspace; the check is now too.

`getAttendeeById` is unscoped and has no callers — dead, but a loaded gun for
whoever wires it up next.

A third test had encoded a leak: "scoping by event keeps org-wide codes" read an
event the file itself identifies as belonging to negar-karimi and expected to
see another workspace's `WELCOME10`. It now uses a sibling event in the owning
workspace, and the cross-tenant case is asserted negatively.


### The standing tenant check

Reading route by route found the discount leaks, but only because I happened to
read the right file. `tests/api/tenant-isolation.test.ts` is the check that does
not depend on that: sign in as one organiser, reach for another organiser's
finances, bank accounts, withdrawals, CRM contacts and discount codes, and
assert that none of it answers 200.

Two details that keep it honest:

- The caller is **negar-karimi**, not the ava-events owner, because that owner
  carries `platformAdmin` in the seed. Using them would make `/api/admin/*`
  correctly answer 200 and the most interesting case in the file would silently
  assert nothing. It caught exactly that on the first run.
- One positive case asserts the caller *can* still read their own workspace. A
  suite of denials proves nothing if the routes are broken for everybody.

Finance turned out to be clean — `removeBankAccount` and `setDefaultBankAccount`
both filter on `{ id, workspaceId }`, and `requestWithdrawal` does too. Discounts
were the outlier, not the rule.


### The test database was growing without limit

Measured rather than guessed: snapshot every table, run the suite, snapshot
again, twice. Each full run was adding **~54 events, ~55 venues, ~49 ticket
types, ~37 orders and ~79 auth sessions** — permanently.

Six suites built a throwaway event through the real API and deleted none of it.
`trackEvent()` / `dropTrackedEvents()` in `tests/api/helpers.ts` now record the
id at creation and remove the whole tree — orders, payments, tickets, check-ins,
holds, seat status, collaborators, registrations, pricing, sessions, types,
event, and the orphaned venue — in foreign-key order.

**Three suites were living off the litter.** `cancel-notify`, `ticket-design`
and `payouts` selected their fixtures with `findFirst({ status: PAID })` or
`findFirst()` on `BankAccount` — and **a clean seed contains no orders and no
bank accounts at all**. They had only ever passed because other suites left rows
behind. Cleaning up broke them, which is the correct outcome: passing on another
suite's litter is not passing. All three now build what they need.

It also explains an earlier misdiagnosis. `session-gate` was blamed on parallel
file execution, but `vitest.config.ts` sets `fileParallelism: false`. The real
cause was that it picked a *stale* «رویداد سفارش» left by a previous run while
`orders.test.ts` used a fresh one.

The residual `Venue`, `Order`, `OrderItem` and `EventCollaborator` drift is
closed too. Three separate causes, each needing a different fix:

- **Venues were inferred from their events.** The cleanup read `venueId` off the
  events it was deleting, so anything that removed an event first lost the only
  link to its venue. A venue outlives its event by design; `trackVenue()` now
  records it independently.
- **Some orders are placed against the *seeded* concert**, not a throwaway
  event, so the tracked-event teardown never saw them. `orders.test.ts` removes
  them by buyer phone.
- **Collaborators cannot be identified by label.** The seeded one is
  «استودیو رویداد آوا» on the same event as the ones the tests add — an attempt
  to filter on label and workspace deleted the seed fixture, and `seed.test.ts`
  caught it. They are recorded by id at creation instead.

Verified across a fresh seed plus three consecutive full runs: every table
returns to exactly its seeded count. The only movement is `Attendee` 3 → 8,
which is settlement upserting buyers as CRM contacts — real product behaviour,
and stable rather than growing.


## A ticket in the holder's calendar

The ticket page showed a QR code and nothing else, which assumes the buyer will
remember to come back to it. Most of a ticket's value is delivered by the
reminder their phone gives them the evening before, and that was left entirely
to them.

`lib/tickets/calendar.ts` emits an `.ics` — a download rather than a link to
Google Calendar, because it works on every phone, needs no account, and does not
tell a third party what its holder is going to. The seat is written into the
entry, so the reminder that arrives says where to sit. `IssuedTicket` gained
`endAt` for it; an open-ended showing gets two hours rather than a zero-length
event that some clients hide.

Hand-written rather than a dependency, because the two parts that are easy to
get wrong are both pure string work and therefore verifiable:

- **Escaping.** Backslash first, or the escapes get escaped again. Commas and
  semicolons are RFC 5545 list separators and an unescaped one silently
  truncates a field. The Persian comma «،» is *not* a separator and passes
  through untouched.
- **Folding at 75 octets, not characters.** Persian is multi-byte in UTF-8, so a
  fold written against `String.length` produces lines well over the limit and
  can split a character in half. The generated file was inspected byte by byte:
  17 lines, longest exactly 75 octets, zero bare LF, unfolds back to the
  original with no replacement characters.

The UID is stable per ticket, so re-adding replaces the entry instead of
duplicating it. A cancelled show offers no button at all — nobody should be
reminded to attend something that is not happening.


## «نمایش ندادن نشانی» has to actually not show it

The flag was honoured by the public event page and by nothing else. `toVenue`
mapped the street address straight onto the wire, so `GET /api/events/:id`
answered it in full to any unauthenticated caller and it sat in the SSR payload
of the page that was hiding it. Verified against the running server before the
fix: the response carried the address with `hideAddress: true` beside it.

An organiser hiding a venue is usually protecting a private address or a
safety-sensitive event. Hidden that survives `curl` is not hidden.

The address and the coordinates are now withheld at the mapper — a precise pin
*is* the address, so they travel together. The **city and province stay**:
hiding a street number is not hiding which city you are in, and discovery
filters on it. `hideAddress` itself stays on the wire too, or the page cannot
tell "withheld" from "not filled in yet".

`toVenue`/`toEvent`/`getEventById` take `{ reveal }`, defaulting to **false**, so
a new caller is private by accident rather than public by accident. Exactly one
caller passes it: `GET /api/events/:id/dashboard`, which already requires
`event:edit` and renders the form that edits the address. Missing that would
have blanked the field on the organiser's own save — the over-correction is as
real a bug as the leak, and the test asserts both directions.


### A co-host's phone number

Following the address leak, every unauthenticated endpoint was swept for PII —
phone numbers, `qrToken`s, IBANs. All clean except one.

`GET /api/events/:id/collaborators` guards on `event:read`, which is granted to
anyone for a published event, and the route already knew this: it restricts
non-managers to *accepted* collaborators with a comment explaining that a
pending invite carries the invitee's raw phone in `sub`.

The reasoning had a gap. Accepting an invitation does not change what that field
holds. An accepted phone co-host was publishing their mobile number to anonymous
callers — verified on the running server, `sub=09121230000`.

`listAcceptedCollaborators` now blanks `sub` for the `phone` channel. A workspace
handle like `@ava-events` is public by nature and stays. **Being credited as a
co-host is public; being reachable is not.** The organiser's own view is
unchanged — they invited the person and need to contact them.


## Credentials do not belong in URLs

An order is the one thing on this platform a **guest** owns: there is no account
behind most of them, so ownership is proved by the phone that placed it.
Cancelling someone else's is not a curiosity — it releases their seats to
whoever asks next.

The ownership checks themselves were correct, and a probe confirmed it: an
anonymous caller, a stranger guessing a phone, and a signed-in non-buyer are all
refused, and the order stays `PENDING_PAYMENT`. What was wrong was the
*transport*. `/orders/:id/cancel` and `/orders/:id/pay` read the phone from
`?phone=`, and `/events/:id/waitlist` did the same for a place lookup.

A phone number in a URL is written to the server's access log, kept in the
browser's history, and sent to third parties in `Referer` — and here it is the
value standing in for a session. Both POST routes now read it from the body;
the waitlist GET has no body, so it takes an `x-waitlist-phone` header. No UI
sent it either way, so nothing broke that a test did not already cover.

`grep -rE 'searchParams\.get\("(phone|token|code|iban|email)"\)'` now returns
nothing.

### A timeout that cascaded

While verifying, one run failed two payout tests and the next passed. Not
accepted as a flake: the first had **timed out at 5 s** and left a withdrawal
behind, and the second then failed by exactly that row's 35,000. `computeFinance`
measures 1–27 ms, so the stall was contention rather than a slow query — but the
*cascade* was a real defect. The teardown now deletes by the suite's own bank
account rather than by the ids it happened to record, so a test that dies
part-way cannot poison the next one. Four consecutive full runs since.


## The organiser's journey, once, end to end

The buyer's journey was driven over HTTP in `docs/venue-architecture.md` §21.
This is the other half — everything an organiser does, in sequence, against the
real data layer:

| step | result |
| --- | --- |
| 1. draft an event at a venue with a seat map | one سانس |
| 2. add a ticket type | ۳۰۰٬۰۰۰ × 50 |
| 3. which maps may it adopt? | 1 published version, 9,080 seats, 6 sections |
| 4. attach and price | 5 sections priced — the sixth is standing |
| 5. availability | `north=50 south=50 east=50` — the 50-ticket allocation, not the section sizes |
| 6. publish | `PUBLISHED`, «خبرم کن» subscribers notified |
| 7. a sale | ۶۰۰٬۰۰۰, paid, 2 tickets |
| 8. the wallet | gross ۶۰۰٬۰۰۰, fee ۱۸٬۰۰۰ (3%), net ۵۸۲٬۰۰۰ |
| 9. cancellation reach, then cancel | 1 buyer, 2 tickets |
| 10. the refund worklist | the buyer, 2 tickets, ۶۰۰٬۰۰۰, `checkedIn=0` |
| 11. the buyer's ticket | `status=issued`, `showCancelled=true` |

Step 5 is the one worth pointing at: a 9,080-seat stadium reporting 50 available
per section is the allocation ceiling doing its job. Before that fix it would
have advertised thousands and refused everyone at submit.

### It found a leak by not adding up

`balance` came back ۱۰۵٬۰۰۰ below `net`, which nothing in the journey explained.
The cause was a pending payout left in the database by `finance.test.ts`, which
cleared withdrawals in **`beforeAll`** — tidying its own runway and leaving its
residue for everything downstream and for the database afterwards. Its
`deleteMany()` was also unscoped, so it would take another suite's live payouts
with it.

Cleaning now happens in `afterAll` as well, scoped to that suite's own IBAN.
With it fixed, a fresh seed plus three consecutive full runs leaves **every**
table at exactly its seeded count.


## The client is half of every contract

Moving `/orders/:id/pay` off `?phone=` was verified three ways — against the
route, against the test suite, and with a grep for `searchParams.get("phone")`
— and it still shipped broken. The checkout page was still building
`?phone=…`, so **guest checkout, the primary purchase path, 403'd at payment**.

Every one of those checks looked at the server. None looked at the caller. The
route tests call the handler directly with a correct body, so they pass whatever
the page does; a grep for the *old server API* cannot find a client that never
used it.

`tests/client-server-contract.test.ts` reads the client source instead — every
`/api/...` string in `app/` and `components/`, excluding route handlers — and
asserts none carries a sensitive value in a query string, with the payment and
cancel calls checked by name. Verified to fail by reintroducing the exact
regression.

The lesson generalises past this one bug: when a request contract changes, the
grep has to be for **callers**, not for the thing being replaced.

So the check now covers the whole contract, statically, from the client side:

| | verified |
| --- | --- |
| the route exists | every `/api/...` a page builds resolves to a `route.ts` |
| the method is handled | no page calls `POST` on a `GET`-only handler |
| required body fields are sent | against each route's zod schema |
| no secrets in the URL | phone, token, iban, email, code |

All four were run across the codebase and all four are clean — 69 routes, 29
schemas. Each was then verified to *fail*: pointing a call at a route that does
not exist, changing `PATCH` to `PUT`, and reintroducing `?phone=` each trip the
matching assertion.

One false positive was chased down rather than reported: the body check flagged
`PendingInvites` for omitting `action`, and the page sends `{ action }` in
shorthand — the parser wanted a trailing comma it had already stripped. The
codebase was right; the instrument was not.


## The dashboard, replayed the same way

The buyer's pages were replayed from their own source in
`docs/venue-architecture.md` §25. The organiser's side gets the same treatment,
signed in as the seeded owner:

Fifteen reads — `auth/me`, `me/invites`, the workspace's events, finance,
attendees and campaigns, the event dashboard, collaborators, holders, waitlist,
refunds (whole event and scoped to a سانس), seat map, and both admin surfaces —
**all 200**. Sign out and the same four come back **401**, so the guard is the
session and not a happy path.

### Response shape, not just status

A 200 with a missing key is a page that renders `undefined`. The manage-event
page destructures eleven fields off `/api/events/:id/dashboard`; every one is
present, and the response carries nothing it does not read. That is the mirror
of the request-body check in `tests/client-server-contract.test.ts` — the same
contract, the other direction.

### Signing in as a script

The OTP is not in the response as `code`; it is `devCode`, and only outside
production. Worth writing down: three separate attempts to script a sign-in
failed on that before the field was actually looked at.
