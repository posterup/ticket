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
