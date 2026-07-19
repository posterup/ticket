# Design System

The Poster design language is calm, professional, and monochrome. The reference
points are Linear, Notion, Vercel, Stripe Dashboard, and Apple: minimal
surfaces, generous whitespace, and confident typography. `DESIGN.md` at the
repository root is the authoritative brand and design specification; this
document maps that system onto the implemented tokens in `app/globals.css` and
is the working reference for building future dashboard pages.

The brand is monochrome (black/white plus a neutral gray scale). Color is
reserved for meaning: blue (`#2563EB`, the semantic "Info") is used only for the
logo mark and informational states, and success/warning/danger communicate
state. Never use a semantic color as a brand fill. Light is the default; dark
mode inverts the neutral scale via `prefers-color-scheme`.

## Color roles

Every color is exposed as a CSS custom property and mapped to a Tailwind color
via `@theme inline` (for example `--color-background` -> `bg-background`).

| Role | Token | Light | Dark |
| --- | --- | --- | --- |
| Page background | `--background` | `#FFFFFF` | `#0A0A0A` |
| Foreground (primary text) | `--foreground` | `#111111` | `#FAFAFA` |
| Secondary text | `--muted` | `#525252` | `#A3A3A3` |
| Muted text / captions | `--faint` | `#A3A3A3` | `#737373` |
| Subtle surface | `--subtle` | `#F5F5F5` | `#1F1F1F` |
| Border | `--border` | `#E5E5E5` | `#2F2F2F` |
| Border (strong / hover) | `--border-strong` | `#D4D4D4` | `#404040` |
| Card surface | `--card` | `#FFFFFF` | `#111111` |
| Info / logo accent | `--accent` | `#2563EB` | `#3B82F6` |
| Success | `--success` | `#16A34A` | `#22C55E` |
| Warning | `--warning` | `#D97706` | `#F59E0B` |
| Danger | `--danger` | `#DC2626` | `#EF4444` |
| Focus ring | `--ring` | `#111111` | `#FAFAFA` |

Usage notes:

- **Monochrome brand.** Primary actions and emphasis are carried by
  `foreground`/`background` (near-black and white), not by color.
- **Blue is semantic, not brand.** `--accent` (Info blue) appears only on the
  logo mark and to mark informational state. `--accent-soft` is its
  low-emphasis tint for info backgrounds.
- **Semantic colors communicate meaning only** (`success`, `warning`,
  `danger`) - for example an active status dot or a positive-change indicator.
- **`muted`** is secondary text, **`faint`** is captions and metadata; keep body
  copy on `foreground`.
- **`subtle`** is the quiet fill for panels and grouped areas that sit on the
  page background without a full card.

## Typography

- **Typeface: Vazirmatn**, self-hosted via `@fontsource-variable/vazirmatn` and
  wired into `--font-sans` with `ui-sans-serif, system-ui, sans-serif` as
  fallbacks. It is the sole UI face (no external font fetch at build time).
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
| `--radius-xl` | `1.25rem` | Modals, dialogs, large containers |

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
  on the `--ring` token (neutral foreground). Do not remove outlines without
  providing an equally visible replacement.
- **Semantic HTML:** use real landmarks and elements (`header`, `nav`, `main`,
  `footer`, `button`, `label`, headings in order). This is the foundation for
  both accessibility and RTL correctness.
- **ARIA:** add ARIA only to fill gaps native semantics cannot, for example
  wizard step state, live regions for async status, and labels for icon-only
  controls. Prefer native semantics first.
- **Contrast:** the `foreground` on `background` pairing, and the inverted
  primary button (`background` on `foreground`), are chosen for readable
  contrast in both themes. Verify any new pairing meets WCAG AA, especially text
  on `muted`/`faint` and on `accent-soft`.
- **RTL:** mirror layout, not glyphs that must stay stable (for example logos
  and Persian numerals). Test every view in RTL as the primary case.

## Component primitives

These are the base primitives future pages compose from. They are owned
components (shadcn-style) styled with the tokens above and merged with the `cn`
helper (`lib/utils.ts`).

### Button

Variants:

- **primary** - solid `foreground` fill with `background` text (near-black in
  light, white in dark). The single most important action on a view.
- **secondary** - `card` surface with a `border` and `foreground` text; the
  border darkens to `border-strong` on hover. Standard, non-primary actions.
- **ghost** - transparent, `foreground` text, subtle hover fill. Low-emphasis
  and toolbar actions.

Sizes: **sm**, **md** (default), **lg**. All sizes use `--radius-md`, show a
visible focus ring on `--ring`, and expose a disabled state at reduced opacity.

### Badge

Variants:

- **accent** - `accent-soft` background with Info-blue text, for informational
  status only. Used sparingly, never as branding.
- **neutral** - `subtle` background with `muted` or `foreground` text and a
  hairline border. Quiet labels, metadata, and "coming soon" tags.

Badges use `--radius-sm`, `text-xs`, medium weight, and compact padding. Use
them for ticket-type tags (for example عمومی, وی‌آی‌پی, دانشجویی), statuses, and
counts, never as buttons.
