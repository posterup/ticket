# پوستر - Event CRM & Ticketing Platform

A Persian-first (RTL) Event CRM and ticketing SaaS for organizations. This
repository currently contains the marketing **landing page** plus the
scaffolding that anticipates the future dashboard and API surface.

> **Note:** All product-facing copy is Persian and the app renders
> right-to-left (`<html lang="fa" dir="rtl">`). English appears only in code
> and documentation.

## Tech stack

- **Next.js 15** (App Router) + **React 19**
- **TypeScript** (strict)
- **Tailwind CSS v4**
- **shadcn/ui**-style primitives (owned components under `components/ui`)
- **Framer Motion** for entrance and micro-interactions
- **Lucide React** icons
- **Vazirmatn** via `next/font/google`

## Project structure

```
app/            # App Router routes + root layout (frontend shell)
  api/          # Route Handlers (backend surface)
components/      # UI components (frontend)
  ui/           # Reusable design-system primitives
lib/            # Shared utilities (cn, motion variants)
  server/       # Backend data-access layer
types/          # Shared domain types
docs/           # Product, design, frontend & backend documentation
```

The frontend (routes, components) and backend (route handlers, data layer)
are separated following Next.js App Router conventions. See `docs/` for
detailed architecture notes.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploying to Vercel

The project is a standard Next.js app and deploys on Vercel with zero
configuration:

1. Push this repository to GitHub.
2. On [vercel.com](https://vercel.com) choose **Add New → Project** and import
   the `posterup/ticket` repository.
3. Keep the defaults (Framework preset: **Next.js**) and click **Deploy**.

Vercel builds `main` for production and creates a preview deployment for every
pull request automatically.
