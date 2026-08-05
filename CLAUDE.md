# CLAUDE.md

Guidance for AI agents (and humans) working in this repository. This file is the
**single source of truth** for cross-cutting facts — tech stack, commands,
architecture, and conventions. Deeper, domain-specific detail lives in the `docs/`
files linked at the bottom; those files reference back here rather than restating
these facts.

## Project

**پوستر (Poster)** — a Persian-first (RTL) Event **CRM & ticketing** SaaS for
organizations. It is a *CRM for events* (the attendee, not the ticket, is the
asset), **not** an event marketplace.

The repository holds the whole product: attendee discovery, public event pages,
checkout with assigned seating, the ticket wallet, the organizer dashboard and
CRM, door check-in, finance and payouts, an internal venue designer, and the
HTTP API all of it runs on. **Pre-launch** — no real organisers, events or
transactions, and search engines are blocked deliberately (`app/robots.ts`).

**Mobile web only, for now.** `components/DesktopGate.tsx` closes every viewport
at or above `1024px` behind a notice. The `lg:` branches are unfinished desktop
work, not dead code — keep writing both.

Product rationale: `PRODUCT.md` (the authoritative product record) and
`docs/product-vision.md`.

## Tech stack

- **Next.js 15** (App Router) + **React 19**
- **TypeScript**, strict
- **HeroUI v3** (`@heroui/react`) — **the component library for all UI**. Built
  on React Aria + Tailwind v4. See the HeroUI rules below.
- **Tailwind CSS v4** — tokens declared in `app/globals.css` and surfaced to
  Tailwind via `@theme inline` (no `tailwind.config` color values). HeroUI reads
  these same raw CSS variables, so the neon brand carries into every HeroUI
  component (see `app/globals.css`).
- **Framer Motion** — entrance and micro-interactions
- **Lucide React** — icons
- **Vazirmatn** — self-hosted via `@fontsource-variable/vazirmatn`, imported in
  `app/layout.tsx` and wired to `--font-sans`. Bundled at build time; **no**
  build-time Google Fonts fetch.
- **class-variance-authority** + `tailwind-merge`/`clsx` (via `cn()`) for
  component variants
- **Leaflet** / **react-leaflet** (maps), **react-multi-date-picker** (Jalali
  dates), **html-to-image** (ticket PNG export)
- **Prisma 7** over **Postgres**, with **zod** validating every request body
- **Vercel Blob** — posters, ticket art and workspace logos upload from the
  browser directly to Blob; `/api/uploads` only signs the request. Stored fields
  hold a URL, never base64.
- **qrcode** — ticket QR codes. Imported **lazily and client-side only**
  (`components/tickets/TicketQr.tsx`): a ticket must render at a venue door with
  no signal, so the code is drawn from the token already in hand rather than
  fetched. Only the module matrix comes from the library; the SVG is built as
  React elements, so no `dangerouslySetInnerHTML`. Door scanning uses the
  browser's native `BarcodeDetector` — no decoder is shipped.

## Commands

Node **24.x** (see `package.json` `engines`) — matched to the Vercel project's
configured runtime; a mismatch there surfaces as "Configuration Settings in the
current Production deployment differ from your current Project Settings".

| Task | Command |
| --- | --- |
| Install | `npm install` |
| Dev server (→ http://localhost:3000) | `npm run dev` |
| Production build | `npm run build` |
| Serve production build | `npm start` |
| Lint | `npm run lint` |
| Tests (Vitest) | `npm test` |
| Type-check only | `npx tsc --noEmit` |
| Full stack in Docker (→ http://localhost:3000) | `docker compose up --build` |
| Seed the Docker database | `docker compose run --rm seed` |

Note: after certain builds a stale `.next` cache can produce false prerender
errors — `rm -rf .next` before trusting a failing `npm run build`.

## Architecture & folder conventions

High-level layout (per-file detail: `docs/frontend-architecture.md` for the
frontend, `docs/backend-architecture.md` for the backend):

```
app/            App Router routes + root layout (frontend shell)
  (auth)/       login, signup
  (dashboard)/  Organizer surfaces
  admin/        Internal staff: venue designer, payout queue
  api/          Route Handlers — the backend HTTP surface (route.ts files)
components/     UI components
  ui/           Thin HeroUI wrappers kept for backward-compatible APIs
lib/            Shared utilities
  client/       Browser-side API client and uploads
  server/       Backend data-access layer
prisma/         Schema, migrations, seed fixtures
types/          Shared domain types — import from "@/types"
tests/          Vitest; tests/api/ imports route handlers directly
docs/           Product, design, frontend & backend docs
```

- **Server Components by default.** Only components that need motion or browser
  APIs are Client Components (`"use client"`), isolated as leaves.
- **Frontend / backend separation by directory.** UI lives under `app/` +
  `components/`; server-only code lives under `types/`, `lib/server/`, and
  `app/api/**/route.ts`, none of which import UI.

## Data layer pattern

`lib/server/` is the data-access layer, over **Postgres via Prisma 7**.

- Data flows one way: `route handler → lib/server → Prisma`.
- Route handlers only parse/validate input; the data-access functions own the
  business logic. Handlers use the shared plumbing in `lib/server/http.ts`
  (`handler`, `ok`, `readJson`, `readQuery`) with zod schemas from
  `lib/server/schemas/`.
- Every `lib/server` export is **async**. Optional/not-found results stay
  `undefined`, never `null`.
- **Rows never leave `lib/server`.** `lib/server/mappers/` converts them to the
  domain types in `types/` — that is the only place `DateTime` becomes an ISO
  string and Prisma's SCREAMING_CASE enums become the hyphenated unions
  (`one-time`, `early-bird`). Keeping it there is what lets `types/` and the
  wire contract stay stable.
- Every API response is an `ApiResponse<T>`: `{ data: T }` on success,
  `{ error: { message, code, details? } }` on error.
- The schema lives in `prisma/schema.prisma`; connection URLs in
  `prisma.config.ts` (Prisma 7 keeps them out of the schema). The generated
  client goes to `generated/` and is git-ignored — run `npm run db:generate`
  after any schema change.
- Seed fixtures live in `prisma/seed-data.ts`. Their ids are load-bearing:
  tests reference them by hand, so never renumber them.

Money is an integer Toman `Int` end to end. Dates are `DateTime` in the
database and ISO 8601 strings on the wire.

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
  CSS variables in `app/globals.css` (surfaced to Tailwind via `@theme inline`,
  and read directly by HeroUI). Never hardcode hex. The brand is a light
  white-neon theme with a hot-pink accent (`--accent`); reserve the accent for
  emphasis and keep surfaces calm. HeroUI-only tokens (`--surface`, `--overlay`,
  `--field-*`, `--radius`, `--focus`) are mapped to the brand in `globals.css`.
  Token mapping and primitive specs: `docs/design-system.md`.
- **HeroUI for everything — do not build bespoke UI components.** Reach for a
  HeroUI component (`import { … } from "@heroui/react"`) for every UI need:
  buttons, inputs, selects, modals, tabs, tables, cards, chips, tooltips, menus,
  etc. **Do not** hand-roll a new styled `<div>`/`<button>` component when HeroUI
  already covers it, and do not add new files under `components/ui` — that folder
  now holds only thin HeroUI wrappers that exist for backward-compatible APIs.
  When a screen needs a control, compose HeroUI primitives; if HeroUI genuinely
  lacks it, ask before creating a bespoke component.
  - HeroUI imports `client-only`, so any module importing `@heroui/react` must be
    a Client Component (`"use client"`). Keep pure helpers (e.g. `cva` recipes
    used by Server Components) in a **separate non-client module** — see
    `components/ui/button-variants.ts`.
  - HeroUI form/interactive components use **React Aria** handlers
    (`onPress`, value-based `onChange`, `onSelectionChange`, `isDisabled`), not
    native DOM events. The `components/ui` wrappers translate these so existing
    call sites keep their native-style API.
- **Components** are small, reusable, and stateless where possible. Shared
  primitives live in `components/ui` (thin HeroUI wrappers). Merge classes with
  `cn()` from `lib/utils.ts`.
- **Motion** is restrained: shared Framer Motion variants in `lib/motion.ts`;
  honor `prefers-reduced-motion`; no bounce or attention-seeking movement.
- **Accessibility:** semantic landmarks, a visible focus ring on `--ring` for
  every interactive element, WCAG AA contrast (verified — see
  `docs/design-system.md`), and ARIA only to
  fill gaps native semantics cannot.

## Git workflow

Commit and push to a **new branch**, never `main`; open a PR and merge with
`gh pr merge <n> --merge --delete-branch`. `bun.lock` is tracked — commit it when
it changes; `.idea/` is gitignored. Verify `npx tsc --noEmit` and `npm test`
before merging.

## Docs map (deeper detail)

| File | Owns |
| --- | --- |
| `docs/product-vision.md` | Mission, positioning, capability map, product principles |
| `docs/information-architecture.md` | Surfaces, route tree, ticket-creation wizard spec |
| `docs/frontend-architecture.md` | Frontend conventions, directory layout, motion, a11y |
| `docs/backend-architecture.md` | Data layer, domain model, API endpoints + samples |
| `docs/venue-architecture.md` | Seat maps: layout templates, progressive rendering, seat holds, the admin designer |
| `DESIGN.md` | Authoritative brand & design spec (raw palette, principles) |
| `docs/design-system.md` | Implemented tokens (CSS vars → Tailwind), primitive specs |
| `docs/roadmap.md` | Phased delivery plan and where it actually stands |
| `PRODUCT.md` | Authoritative product record: users, positioning, constraints, principles |
| `README.md` | Getting started, messaging/env config, Vercel deploy |
</content>
</invoke>
