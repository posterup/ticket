# Frontend Architecture

The frontend is a Next.js 15 App Router application: a Persian-first (RTL)
attendee experience (explore, event pages, checkout, ticket wallet), an
organizer dashboard, and an internal admin surface. For the tech stack and
cross-cutting conventions see `CLAUDE.md`; for the route tree and what each
surface is for, `docs/information-architecture.md`.

**Mobile-first, desktop open.** The gate that closed every viewport at or above
`1024px` behind a notice has been removed. The `lg:` branches throughout the
codebase are still unfinished in places — keep writing both, and expect a laptop
visitor to reach them. Rationale: `PRODUCT.md`.

## Principles

- **Server Components by default.** Only components that need motion, state or
  browser APIs are Client Components (`"use client"`), isolated as leaves.
  HeroUI imports `client-only`, so any module importing `@heroui/react` is one.
- **HeroUI for everything.** Do not hand-roll styled controls; `components/ui`
  holds thin wrappers that exist only to keep native-style APIs at call sites.
- **RTL and Persian only.** Logical utilities (`me-*`, `ms-*`, `start-*`,
  `end-*`) over physical left/right. See the RTL rule in `CLAUDE.md`.
- **Design tokens over ad-hoc values.** Colors, radii and fonts come from the
  CSS variables in `app/globals.css`, surfaced to Tailwind through
  `@theme inline` and read directly by HeroUI. See `docs/design-system.md`.
- **Never quote a number the server will not honour.** Prices, totals and
  availability shown to a buyer are a preview of a server decision.

## Directory layout

```
app/
  layout.tsx           Root layout: <html lang="fa" dir="rtl">, Vazirmatn, SessionProvider
  globals.css          Tailwind v4 + design tokens
  error.tsx global-error.tsx not-found.tsx loading.tsx   Persian failure screens
  robots.ts            Disallows all crawlers until launch
  (auth)/              login, signup
  (dashboard)/         Organizer shell: events, customers, finance, marketing,
                       promotions, checkin, notifications, profile, settings,
                       tickets/customize, workspaces/new
  admin/               Internal staff: venue designer, payout queue
  events/              Explore, public event page, checkout
  feed/ me/ orders/ pages/ w/[slug]   Attendee surfaces and organizer pages
  tickets/create/      The 3-step creation wizard
  api/                 Route Handlers — the backend (see backend-architecture.md)

components/
  AppShell AppChrome AppTopBar AppBottomNav   The mobile shell
  PublicHeader Header Footer ErrorScreen Logo
  ui/          Thin HeroUI wrappers + button-variants.ts (non-client, for RSC)
  admin/ analytics/ auth/ checkin/ checkout/ create/ dashboard/ events/
  feed/ finance/ landing/ marketing/ me/ seatmap/ skeletons/ tickets/
  workspace/   WorkspaceAvatar, WorkspaceBanner, FollowChip

lib/
  client/      api.ts (apiFetch/useApi), upload.ts, session.tsx
  create/ events/ tickets/ venues/ checkin/ wizard/ geo/
  motion.ts    Shared Framer Motion variants
  utils.ts     cn() class merger
  flags.ts     NEXT_PUBLIC_* feature flags
  format.ts    Persian numerals, Jalali dates, Asia/Tehran times
```

## Data fetching

Client screens go through `lib/client/api.ts`: `useApi<T>(path)` for reads
(returning `{ data, error, loading, reload }`, rendered by
`components/ui/async-state.tsx`) and `apiFetch<T>` for writes. Both unwrap the
`ApiResponse` envelope and raise `ApiCallError`, which carries the envelope's
code so callers can branch on `SOLD_OUT` rather than on a message. A dead
session is signed out and bounced to `/login` once, from there — not reported
as text on a screen the reader cannot act on.

Skeletons are shaped like the page they stand in for (`components/skeletons/`,
asserted by `tests/loading-shape.test.ts`); a shimmer that promises a layout
the page does not have is worse than none.

## The active workspace

An organiser may belong to several. Which one the dashboard is acting on lives
in **one place**: `components/dashboard/ActiveWorkspace.tsx`, a context seeded
by the shell and backed by a cookie — a cookie rather than `localStorage`
because the dashboard renders on the server and the API routes resolve the same
choice there, re-checking it against real memberships.

Every consumer reads `useWorkspaceSwitcher()` / `useActiveWorkspace()`. Do not
keep a second copy. The switcher moved off `localStorage` and the profile card
and its edit form did not, so the two could disagree — and the edit form would
then save to a workspace the rest of the dashboard was not showing.

## Images

Posters, ticket art and workspace logos are uploaded from the browser straight
to Vercel Blob through `lib/client/upload.ts`; `/api/uploads` only signs the
request. Stored fields hold a **URL**, never base64 — a data URL travels in the
SSR payload of every page that reads the row.

`uploadImage` **downscales before sending**, to the longest edge its kind is
actually rendered at (`MAX_DIMENSION` in `lib/uploads.ts`) and re-encodes to
WebP — WebP rather than JPEG because it keeps the alpha channel, and a logo
with a transparent background is exactly the case that would otherwise come
back with a black box behind it. Measured in Chrome: a 4000×3000, 10.7 MB photo
becomes 658 KB at 1600×1200. Every failure path returns the original file, and
a small crisp image is passed through untouched rather than round-tripped
through a lossy codec.

That is also why the two guards run at different moments: **format** is refused
before any decoding, **size** is checked on what is about to be sent. Refusing a
9 MB camera photo that would have become 200 KB is the wrong answer to the right
question.

They render as plain `<img>`, not `next/image`: the host is a Blob domain only
known at runtime. Server-side, `isStoredImage` (`lib/uploads.ts`) is what keeps
an image field from becoming a pointer at any host on the internet.

## Motion

Shared variants live in `lib/motion.ts` (`staggerContainer` / `fadeUpItem`).
Motion is restrained — opacity and small transforms, easing `[0.16, 1, 0.3, 1]`,
no bounce. `app/globals.css` collapses transitions under
`prefers-reduced-motion` and components honour it too.

## Accessibility

- Semantic landmarks; visible focus rings on `--ring` for every interactive
  element; ARIA only where native semantics cannot reach.
- WCAG AA contrast is **verified, not assumed** — `tests/contrast.test.ts` and
  `tests/token-contrast.test.ts` assert the token ratios, and changes have been
  rejected for dropping one below 4.5:1. The audit is in
  `docs/design-system.md`.
- Touch targets follow WCAG 2.2 SC 2.5.8 (24×24 floor; seat buttons are 44×44,
  because a mis-tap there costs a sale).
- Persian needs more size than Latin: 11px is the floor, 12px comfortable.

## Responsiveness

Mobile-first, one-handed. Layout uses `min-h-[100dvh]`, never `h-screen`. Wide
content scrolls inside its own container — `html` sets `overflow-x: hidden` so
the page body never scrolls sideways.
