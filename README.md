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

## Messaging (SMS & email)

Campaigns send through server-side Route Handlers, so **no mail/SMS server is
required** - on Vercel the handlers run serverless per request. Configure these
environment variables (see `.env.example`) locally in `.env.local` and in
Vercel → Project → Settings → Environment Variables:

| Variable | Service | Purpose |
| --- | --- | --- |
| `SMSIR_API_KEY` | [sms.ir](https://sms.ir) | SMS API key |
| `SMSIR_LINE_NUMBER` | sms.ir | Sender line number |
| `RESEND_API_KEY` | [Resend](https://resend.com) | Email API key |
| `EMAIL_FROM` | Resend | Verified sender, e.g. `پوستر <noreply@yourdomain.ir>` |

- SMS: `POST /api/sms/send` → sms.ir bulk send (`lib/server/sms/smsir.ts`).
- Email: `POST /api/email/send` → Resend batch (`lib/server/email/resend.ts`).

Until the keys are set, the marketing composer reports that the service is not
configured rather than sending. Resend has a free tier and needs no SMTP
server; alternatives include Postmark, SendGrid, and Amazon SES.

## Deploying to Vercel

The project is a standard Next.js app and deploys on Vercel with zero
configuration:

1. Push this repository to GitHub.
2. On [vercel.com](https://vercel.com) choose **Add New → Project** and import
   the `posterup/ticket` repository.
3. Keep the defaults (Framework preset: **Next.js**) and click **Deploy**.

Vercel builds `main` for production and creates a preview deployment for every
pull request automatically.
