# پوستر - Event CRM & Ticketing Platform

A Persian-first (RTL) Event CRM and ticketing SaaS for organizations. This
repository currently contains the marketing **landing page** plus the
scaffolding that anticipates the future dashboard and API surface.

> **Note:** All product-facing copy is Persian and the app renders
> right-to-left (`<html lang="fa" dir="rtl">`). English appears only in code
> and documentation.

## Tech stack & structure

See [`CLAUDE.md`](CLAUDE.md) for the full tech stack, the folder map, and the
architecture conventions. Deeper per-file layouts live in
`docs/frontend-architecture.md` and `docs/backend-architecture.md`.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`npm install` runs `prisma generate`, which needs no database. The app itself
does: set one up first (below).

## Running with Docker

The whole platform — Postgres, migrations and the app — comes up with one
command. Nothing needs to be installed but Docker.

```bash
docker compose up --build          # app on http://localhost:3000
docker compose run --rm seed       # load the demo fixtures (optional)
docker compose down                # stop; add -v to delete the database too
```

Three services. `db` is Postgres 16 on a named volume, published on host port
**5435** so it does not collide with a local Postgres or the standalone
container described below. `migrate` runs `prisma migrate deploy` once and
exits; `app` waits for it to succeed, so the schema is always in place before
the first request. `seed` is the same image with a different command and sits
behind the `tools` profile, so it only runs when asked.

The app image uses Next's standalone output and ships no `node_modules`,
running as an unprivileged user. The Prisma CLI and its engines stay in the
migration image and never reach the container that faces traffic.

Configuration comes from the compose file, not from a baked-in `.env` — that
file is excluded from the image. Development defaults are filled in for
everything, so `up` works on a fresh clone; override them with real environment
variables before this points anywhere that matters. Two are worth knowing:

- `AUTH_SECRET` defaults to a development value. Generate a real one with
  `openssl rand -base64 32`.
- `PAYMENT_PROVIDER` is set to `mock`, which settles orders **without taking
  money**. Switch it to `zarinpal` with a `ZARINPAL_MERCHANT_ID` for anything
  real.

`NEXT_PUBLIC_*` values are inlined into the client bundle at build time, so
they are passed as build arguments rather than runtime environment variables —
changing one needs `--build`.

Note that the stack always talks to its own `db` service. `DATABASE_URL` is
composed from the `POSTGRES_*` values instead of being read from the
environment, because Compose interpolates from the project's `.env`, and that
file holds the URL for running the app *outside* Docker — where `localhost`
means the host, not the container.

## Database

`lib/server/` reads Postgres through Prisma, so the app needs a `DATABASE_URL`.
Any Postgres works. Locally:

```bash
docker run -d --name poster-db \
  -e POSTGRES_PASSWORD=poster -e POSTGRES_DB=poster \
  -p 5434:5432 postgres:16

echo 'DATABASE_URL="postgresql://postgres:poster@localhost:5434/poster?schema=public"' > .env

npm run db:migrate   # apply migrations
npm run db:seed      # load the fixtures
```

For a managed database instead, `npx prisma init --db` provisions Prisma
Postgres and writes `DATABASE_URL` for you — it needs an interactive terminal
for the browser login.

| Script | Purpose |
| --- | --- |
| `npm run db:generate` | Regenerate the client (also runs on `postinstall`) |
| `npm run db:migrate` | Create and apply a migration in development |
| `npm run db:seed` | Load the fixtures |
| `npm run db:reset` | Drop, re-migrate and re-seed — **destroys all data** |
| `npm run db:studio` | Browse the data |

The seed preserves every hardcoded fixture id, so a reset produces a database
indistinguishable from the in-memory arrays it mirrors. It also creates four
sign-in accounts, one owning each workspace: `09120000001` (ava-events),
`09120000002` (negar-karimi), `09120000003` (chef-collective) and
`09120000004` (iran-runners).

Connection URLs live in `prisma.config.ts` (Prisma 7 keeps them out of the
schema), read from `DATABASE_URL` in `.env`. The generated client is written to
`generated/` and is git-ignored.

Without `DATABASE_URL` the suite still passes: the suites that need a database
skip themselves rather than failing (100 tests run, 91 skip). With one, all 191
run — seed the database first, since they assert against the fixtures.

## Messaging (SMS)

Everything the platform sends goes out as SMS through a server-side Route
Handler, so **no mail or SMS server is required** — on Vercel the handlers run
serverless per request.

Two providers are supported. `SMS_PROVIDER` picks one; leaving it unset falls
back to whichever set of credentials is actually present, so a deployment that
only ever configured sms.ir keeps working without a new variable.

| Variable | Service | Purpose |
| --- | --- | --- |
| `SMS_PROVIDER` | — | `kavenegar` or `smsir`. Unset auto-detects. |
| `KAVENEGAR_API_KEY` | [Kavenegar](https://kavenegar.com) | API key |
| `KAVENEGAR_SENDER` | Kavenegar | Sender line |
| `KAVENEGAR_OTP_TEMPLATE` | Kavenegar | Verify-lookup template name |
| `SMSIR_API_KEY` | [sms.ir](https://sms.ir) | API key |
| `SMSIR_LINE_NUMBER` | sms.ir | Sender line number |
| `SMSIR_OTP_TEMPLATE_ID` | sms.ir | Verify template id |

Until a key is set, `smsGateway().configured` is false: every notifier returns
quietly and the marketing composer reports that the service is not configured
rather than pretending to send.

**Nothing here has been exercised against a live operator.** The provider
contract, the gateway selection and every notifier are unit-tested against a
stub; the actual HTTP call, template approval and delivery are not. Set
`KAVENEGAR_API_KEY` to close that gap.

### What gets sent, and to whom

| Moment | Buyer / guest | Organiser |
| --- | --- | --- |
| Order settles | tickets issued, seats, tracking code | new sale, buyer, total |
| Inventory frees up | waitlist, in queue order | — |
| سانس or event cancelled | show is off, refund coming | — |
| Refund recorded | amount and tracking code | — |
| Event published | «خبرم کن» subscribers | — |
| Request to attend | — | who, how many |
| Request accepted/rejected | the answer | — |
| Invited to co-host | the invitee, or their workspace's owners | — |
| Sign-in | OTP | — |

### Email is not implemented

Earlier revisions of this file documented `RESEND_API_KEY`, `EMAIL_FROM` and a
`POST /api/email/send` backed by `lib/server/email/resend.ts`. **None of it
exists** — there is no email module, no route, and `Campaign.channel` only ever
holds `sms`. The variables have been removed from `.env.example` too: documented
configuration for a feature that does not exist is worse than no documentation,
because someone will set it and wait for mail that never comes.

## Deploying to Vercel

1. Push this repository to GitHub.
2. On [vercel.com](https://vercel.com) choose **Add New → Project** and import
   the `posterup/ticket` repository. Keep the **Next.js** framework preset.
3. Provision a Postgres database and set the environment variables below
   **before** the first deploy — the build runs migrations against
   `DATABASE_URL` and fails without it.
4. Deploy.

Required in production:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | **Pooled** Postgres connection string. What the running app uses. |
| `DATABASE_URL_UNPOOLED` | **Direct** (unpooled) connection string, used only by `prisma migrate`. Neon and the Vercel Postgres integration both set this name for you. See the warning below — this is the one that is easy to miss and expensive to miss. |
| `AUTH_SECRET` | Peppers the one-time-code hashes. Generate with `openssl rand -base64 32`. Sign-in throws without it. |
| `PAYMENT_PROVIDER` | `zarinpal`, `zarinpal-sandbox`, or an explicit `mock`. Production **refuses to fall back** — the mock settles orders without taking money. |
| `ZARINPAL_MERCHANT_ID` | Required when `PAYMENT_PROVIDER=zarinpal`. |
| `BLOB_READ_WRITE_TOKEN` | Signs browser uploads of posters and images to Vercel Blob. Injected automatically once a Blob store is linked (**Storage → Blob → Connect**); uploads fail at runtime without it. |

> **Migrate on the direct URL, never the pooled one.** `prisma.config.ts` reads
> `DATABASE_URL_UNPOOLED ?? DATABASE_URL`, so leaving the first unset silently
> runs migrations through the pooler. DDL depends on session state — advisory
> locks, `SET`s, prepared statements — that a pooler in transaction mode does
> not keep, so the migration fails or, worse, half-applies and leaves a schema
> no later migration expects. The fallback exists for a plain local Postgres,
> which has no pooler in front of it. It is not a production configuration.

Optional: `APP_URL` (gateway return origin — defaults to the request origin),
`KAVENEGAR_*` and `SMSIR_*` (messaging; features report "not configured" until
set), `NEXT_PUBLIC_CALENDAR_MODE` (feature flag).

### Applying migrations

`postinstall` runs `prisma generate`, so a build never needs a database.
Migrations are a **separate, deliberate step**:

```bash
vercel env pull .env.local   # brings DATABASE_URL_UNPOOLED down; gitignored
npm run db:deploy            # prisma migrate deploy
```

They used to run inside `vercel.json`'s build command. That made every build a
migration — including preview builds, which meant opening a pull request could
migrate whatever database that environment pointed at, and a rolled-back deploy
left a schema that had already moved on. Worse, a build that failed halfway
left the schema ahead of the code that shipped. Deploys and schema changes have
different blast radii and now have different triggers: migrate first, confirm,
then deploy.

Vercel builds `main` for production and creates a preview deployment for every
pull request automatically.

**Before going public:** the site is currently withheld from search engines —
`app/robots.ts` disallows all crawlers and the root layout sets
`robots: { index: false }`. Both need flipping at launch.
