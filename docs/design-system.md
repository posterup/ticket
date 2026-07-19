# Design System

The Poster design language is calm, premium, and professional. The reference
points are Stripe, Linear, Vercel, and Notion: minimal surfaces, a single
restrained accent, generous whitespace, and confident typography. This document
is the working reference for building future dashboard pages and should stay
accurate to the tokens defined in `app/globals.css`.

All values below are the actual implemented tokens. Colors use the `oklch`
color space. Light is the default; dark mode is honored via
`prefers-color-scheme`. There is no pure black or pure white in the palette.

## Color roles

Every color is exposed as a CSS custom property and mapped to a Tailwind color
via `@theme inline` (for example `--color-background` -> `bg-background`).

| Role | Token | Light (oklch) | Dark (oklch) |
| --- | --- | --- | --- |
| Page background | `--background` | `0.99 0.002 264` | `0.17 0.015 264` |
| Foreground text | `--foreground` | `0.21 0.02 264` | `0.96 0.004 264` |
| Muted text | `--muted` | `0.55 0.02 264` | `0.68 0.02 264` |
| Subtle surface | `--subtle` | `0.96 0.004 264` | `0.22 0.02 264` |
| Border | `--border` | `0.92 0.006 264` | `0.28 0.02 264` |
| Card surface | `--card` | `1 0 0` | `0.21 0.02 264` |
| Accent | `--accent` | `0.54 0.2 262` | `0.62 0.19 262` |
| Accent foreground | `--accent-foreground` | `0.99 0.002 264` | `0.15 0.02 264` |
| Accent soft (tint) | `--accent-soft` | `0.95 0.03 262` | `0.28 0.05 262` |
| Focus ring | `--ring` | `0.54 0.2 262` | `0.62 0.19 262` |

Usage notes:

- **One accent, used sparingly.** The cobalt blue accent marks the single most
  important action or state on a view. Overuse dilutes it.
- **`accent-soft`** is the low-emphasis tint of the accent, for backgrounds of
  badges, highlighted rows, and quiet emphasis.
- **`muted`** is for secondary text and metadata; keep body copy on
  `foreground`.
- **`subtle`** is the quiet fill for panels and grouped areas that sit on the
  page background without a full card.
- Neutrals are slate-based (hue ~264) so the whole surface reads as a cool,
  professional gray rather than a warm or pure gray.

## Typography

- **Typeface: Vazirmatn**, loaded via `next/font/google` and exposed as the CSS
  variable `--font-vazirmatn`. It is the sole UI face, wired into
  `--font-sans` with `ui-sans-serif, system-ui, sans-serif` as fallbacks.
- **Direction: RTL.** The document is `<html lang="fa" dir="rtl">`. All layout,
  alignment, and iconography assume right-to-left as the default.
- **Persian only in the UI.** Product-facing copy and numerals are Persian.
  English appears only in code and documentation, never in the interface.
- **Font smoothing** is enabled (`-webkit-font-smoothing: antialiased`,
  `text-rendering: optimizeLegibility`) for crisp Persian glyphs.

### Type scale

Use Tailwind's default type scale with restraint. Suggested roles:

| Role | Approx size | Weight |
| --- | --- | --- |
| Display / hero | `text-4xl`+ | 700 |
| Page title | `text-2xl` | 700 |
| Section heading | `text-xl` | 600 |
| Card / subheading | `text-lg` | 600 |
| Body | `text-base` | 400 |
| Secondary / meta | `text-sm` on `muted` | 400 |
| Caption / label | `text-xs` | 500 |

Keep line length comfortable and lean on whitespace over rules and boxes to
create hierarchy.

## Spacing

Use Tailwind's 4px spacing scale. The house style is spacious: prefer larger
gaps between sections (for example `space-y-8` / `gap-6` and up at the page
level) and comfortable internal padding on cards (`p-6` and up). Whitespace is a
primary tool for the premium feel, not an afterthought.

## Radius scale

| Token | Value | Typical use |
| --- | --- | --- |
| `--radius-sm` | `0.5rem` | Inputs, small controls, badges |
| `--radius-md` | `0.75rem` | Buttons, inline elements |
| `--radius-lg` | `1rem` | Cards, panels |
| `--radius-xl` | `1.5rem` | Hero surfaces, large containers |

Corners are soft. Pair rounded surfaces with the soft `border` token rather than
hard, high-contrast outlines.

## Elevation and shadow

Elevation is quiet. Prefer flat surfaces separated by the `border` token and
`subtle`/`card` fills over heavy drop shadows. When a shadow is needed (raised
cards, popovers, menus), use a soft, low-opacity shadow tinted toward the slate
neutral rather than neutral black. The goal is gentle depth, not drama. Stacking
order should read as: page background -> `subtle` panels -> `card` surfaces ->
elevated overlays.

## Motion

- **Library: Framer Motion.** Motion is premium and restrained: fade-up on
  entrance, staggered reveals for lists and groups, and a gentle float for hero
  accents.
- **Easing:** `[0.16, 1, 0.3, 1]` (a soft ease-out) for entrances and
  transitions.
- **Restraint:** animate opacity and small transforms. Avoid long durations,
  bounce, or attention-seeking movement. Motion should feel like the interface
  settling, not performing.
- **Reduced motion:** honor `prefers-reduced-motion`. `globals.css` already
  collapses animation and transition durations to near-zero and disables smooth
  scroll under that query; component-level motion must respect it too (Framer
  Motion's reduced-motion handling or conditional variants).

## Accessibility

- **Focus rings:** every interactive element shows a visible focus state built
  on the `--ring` token (the accent). Do not remove outlines without providing
  an equally visible replacement.
- **Semantic HTML:** use real landmarks and elements (`header`, `nav`, `main`,
  `footer`, `button`, `label`, headings in order). This is the foundation for
  both accessibility and RTL correctness.
- **ARIA:** add ARIA only to fill gaps native semantics cannot, for example
  wizard step state, live regions for async status, and labels for icon-only
  controls. Prefer native semantics first.
- **Contrast:** the `foreground` on `background` and `accent-foreground` on
  `accent` pairings are chosen for readable contrast in both themes. Verify any
  new pairing meets WCAG AA, especially text on `accent-soft` and on `muted`.
- **RTL:** mirror layout, not glyphs that must stay stable (for example logos
  and Persian numerals). Test every view in RTL as the primary case.

## Component primitives

These are the base primitives future pages compose from. They are owned
components (shadcn-style) styled with the tokens above and merged with the `cn`
helper (`lib/utils.ts`).

### Button

Variants:

- **primary** - solid `accent` fill with `accent-foreground` text. The single
  most important action on a view.
- **secondary** - `subtle` or `card` surface with a `border` and `foreground`
  text. Standard, non-primary actions.
- **ghost** - transparent, `foreground` text, subtle hover fill. Low-emphasis
  and toolbar actions.

Sizes: **sm**, **md** (default), **lg**. All sizes use `--radius-md`, show a
visible focus ring on `--ring`, and expose a disabled state at reduced opacity.

### Badge

Variants:

- **accent** - `accent-soft` background with accent-toned text. Highlights a
  status or category tied to the primary action color.
- **neutral** - `subtle` background with `muted` or `foreground` text. Quiet
  labels and metadata.

Badges use `--radius-sm`, `text-xs`, medium weight, and compact padding. Use
them for ticket-type tags (for example عمومی, وی‌آی‌پی, دانشجویی), statuses, and
counts, never as buttons.
