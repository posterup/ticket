# Frontend Architecture

The frontend is a Next.js 15 App Router application rendering a Persian-first
(RTL) landing page for the Poster Event CRM. It is intentionally structured so
that the same conventions scale to the future organizer dashboard.

## Principles

- **Server Components by default.** Only components that need motion or browser
  APIs are Client Components (`"use client"`), isolated as leaves.
- **RTL and Persian only.** The document is `<html lang="fa" dir="rtl">`. All
  user-facing copy is Persian; English appears only in code and docs. Logical
  properties and Tailwind's RTL-aware utilities (`me-*`, `ms-*`) are preferred
  over physical left/right.
- **Design tokens over ad-hoc values.** Colors, radii, and fonts come from CSS
  variables defined in `app/globals.css` and surfaced to Tailwind through
  `@theme inline`. See `docs/design-system.md`.
- **Small, reusable components.** Presentation lives in focused files; shared
  primitives live under `components/ui`.

## Directory layout

```
app/
  layout.tsx        # Root layout: <html lang="fa" dir="rtl">, Vazirmatn font, metadata
  page.tsx          # Landing route: composes Header + Hero + Footer
  globals.css       # Tailwind v4 + design tokens (light/dark)
components/
  Header.tsx        # Sticky, transparent header; blurred surface on scroll (client)
  Hero.tsx          # Centered hero; staggered reveal (client)
  HeroButtons.tsx   # Primary + disabled "coming soon" CTA (client)
  HeroIllustration.tsx  # Abstract CSS/Tailwind illustration with gentle float (client)
  Footer.tsx        # Minimal footer (server)
  Logo.tsx          # Brand wordmark (server)
  ui/
    button.tsx      # Design-system button (cva variants)
    badge.tsx       # Design-system badge (cva variants)
lib/
  utils.ts          # cn() class merger
  motion.ts         # Shared Framer Motion variants
```

## Motion

Framer Motion powers entrance and micro-interactions. Shared variants live in
`lib/motion.ts`:

- `staggerContainer` / `fadeUpItem` drive the hero's sequenced reveal.
- The header entrance and the illustration's gentle float are local to their
  components.

All motion is restrained and honors `prefers-reduced-motion`: the illustration
disables its float loop, and `app/globals.css` collapses transitions globally
under reduced motion. Scroll state in the header is read via Framer Motion's
`useScroll` + `useMotionValueEvent` rather than a manual scroll listener, so the
component only re-renders when the blur threshold is crossed.

## Accessibility

- Semantic landmarks: `<header>`, `<main>`, `<footer>`.
- Visible focus rings on every interactive element (`focus-visible:ring-*`).
- The disabled "view events" CTA is a real `button[disabled]` with
  `aria-disabled` and a descriptive `aria-label`; the decorative illustration is
  `aria-hidden`.
- Color pairings target WCAG AA contrast in both light and dark themes.

## Routing and future surfaces

The primary CTA routes to `/tickets/create` (the 3-step ticket-creation wizard,
documented in `docs/information-architecture.md`). Component conventions here are
designed to extend to future route groups (for example a `(dashboard)` group)
without rework: shared primitives in `components/ui`, tokens in `globals.css`,
and motion variants in `lib/motion.ts`.

## Responsiveness

Mobile-first. The hero text column is capped near 700px and scales its type from
`text-4xl` up to `text-5xl`; the illustration's floating cards use responsive
offsets and hide the least important card on the smallest screens. Layout uses
`min-h-[100dvh]` (never `h-screen`) to avoid mobile viewport jumps.
