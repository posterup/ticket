# CLAUDE.md

Guidance for AI agents (and humans) working in this repository. This file is the
**single source of truth** for cross-cutting facts — tech stack, commands,
architecture, and conventions. Deeper, domain-specific detail lives in the `docs/`
files linked at the bottom; those files reference back here rather than restating
these facts.

## Project

**پوستر (Poster)** — a Persian-first (RTL) Event **CRM & ticketing** SaaS for
organizations. It is a *CRM for events* (the attendee, not the ticket, is the
asset), **not** an event marketplace. The repository today contains the marketing
**landing page** plus the scaffolding that anticipates the future organizer
dashboard and API. Product rationale: `docs/product-vision.md`.

## Tech stack

- **Next.js 15** (App Router) + **React 19**
- **TypeScript**, strict
- **Tailwind CSS v4** — tokens declared in `app/globals.css` and surfaced to
  Tailwind via `@theme inline` (no `tailwind.config` color values)
- **Framer Motion** — entrance and micro-interactions
- **Lucide React** — icons
- **Vazirmatn** — self-hosted via `@fontsource-variable/vazirmatn`, imported in
  `app/layout.tsx` and wired to `--font-sans`. Bundled at build time; **no**
  build-time Google Fonts fetch.
- **class-variance-authority** + `tailwind-merge`/`clsx` (via `cn()`) for
  component variants
- **Leaflet** / **react-leaflet** (maps), **react-multi-date-picker** (Jalali
  dates), **html-to-image** (ticket PNG export)

## Commands

Node **22.x** (see `package.json` `engines`).

| Task | Command |
| --- | --- |
| Install | `npm install` |
| Dev server (→ http://localhost:3000) | `npm run dev` |
| Production build | `npm run build` |
| Serve production build | `npm start` |
| Lint | `npm run lint` |
| Tests (Vitest) | `npm test` |
| Type-check only | `npx tsc --noEmit` |

Note: after certain builds a stale `.next` cache can produce false prerender
errors — `rm -rf .next` before trusting a failing `npm run build`.

## Architecture & folder conventions

High-level layout (per-file detail: `docs/frontend-architecture.md` for the
frontend, `docs/backend-architecture.md` for the backend):

```
app/            App Router routes + root layout (frontend shell)
  api/          Route Handlers — the backend HTTP surface (route.ts files)
components/     UI components
  ui/           Owned, shadcn-style design-system primitives
lib/            Shared utilities
  server/       Backend data-access layer
types/          Shared domain types — import from "@/types"
docs/           Product, design, frontend & backend docs
```

- **Server Components by default.** Only components that need motion or browser
  APIs are Client Components (`"use client"`), isolated as leaves.
- **Frontend / backend separation by directory.** UI lives under `app/` +
  `components/`; server-only code lives under `types/`, `lib/server/`, and
  `app/api/**/route.ts`, none of which import UI.

## Data layer pattern

`lib/server/` is the data-access layer — currently an **in-memory mock**
(`lib/server/store.ts` seed arrays), designed to be swapped for a real datastore
(e.g. Postgres via Prisma/Drizzle) **without changing call sites or types**.

- Data flows one way: `route handler → lib/server → store`.
- Route handlers only parse/validate input; the data-access functions own the
  business logic.
- Every API response is an `ApiResponse<T>`: `{ data: T }` on success,
  `{ error: { message, code } }` on error.

Full endpoint table and request/response samples: `docs/backend-architecture.md`.

## Domain concepts

- **Event** — `title`, `description`, `venue`, `tags`, `status`, plus an
  `EventMode` of `one-time | recurring | multi-session`. Recurring events carry a
  `RecurrenceRule`; concrete occurrences are `EventSession`s.
- **TicketType** — unbounded list per event; `price` (**integer Toman**),
  `capacity`, sales window, and a `TicketCategory`
  (`general | vip | student | early-bird | backstage | group`). Issued `Ticket`s
  reference a type and carry a `qrToken` + `TicketStatus`.
- **Attendee** — event-independent CRM contact with `tags`, `notes`, and
  `customFields`.
- All dates are **ISO 8601** strings; all money is **integer Toman**.
- The 3-step ticket-creation wizard (`/tickets/create`: Event Information →
  Schedule & Availability → Ticket Types) is the canonical creation flow. Full
  field-level spec: `docs/information-architecture.md`.

## Conventions & code style

- **RTL & Persian-first.** The document is `<html lang="fa" dir="rtl">`. All
  user-facing copy and numerals are Persian; English appears only in code and
  docs. Prefer logical / RTL-aware Tailwind utilities (`me-*`, `ms-*`, `start-*`,
  `end-*`) over physical `left`/`right`. This is the single most cross-cutting
  rule in the codebase.
- **Design tokens over ad-hoc values.** Colors, radii, and fonts come from the
  CSS variables in `app/globals.css` (surfaced to Tailwind via `@theme inline`).
  Never hardcode hex. The brand is monochrome; color is reserved for meaning
  (blue = semantic *Info* + the logo mark only). Brand spec: `DESIGN.md`; token
  mapping and primitive specs: `docs/design-system.md`.
- **Components** are small, reusable, and stateless where possible. Shared
  primitives live in `components/ui` (owned, shadcn-style). Merge classes with
  `cn()` from `lib/utils.ts`.
- **Motion** is restrained: shared Framer Motion variants in `lib/motion.ts`;
  honor `prefers-reduced-motion`; no bounce or attention-seeking movement.
- **Accessibility:** semantic landmarks, a visible focus ring on `--ring` for
  every interactive element, WCAG AA contrast in light + dark, and ARIA only to
  fill gaps native semantics cannot.

## Git workflow

Commit and push to a **new branch**, never `main`; open a PR and merge with
`gh pr merge <n> --merge --delete-branch`. Exclude `.idea/` and `bun.lock` from
commits. Verify `npx tsc --noEmit` and `npm test` before merging.

## Docs map (deeper detail)

| File | Owns |
| --- | --- |
| `docs/product-vision.md` | Mission, positioning, capability map, product principles |
| `docs/information-architecture.md` | Surfaces, route tree, ticket-creation wizard spec |
| `docs/frontend-architecture.md` | Frontend conventions, directory layout, motion, a11y |
| `docs/backend-architecture.md` | Data layer, domain model, API endpoints + samples |
| `DESIGN.md` | Authoritative brand & design spec (raw palette, principles) |
| `docs/design-system.md` | Implemented tokens (CSS vars → Tailwind), primitive specs |
| `docs/roadmap.md` | Phased delivery plan |
| `README.md` | Getting started, messaging/env config, Vercel deploy |
</content>
</invoke>
