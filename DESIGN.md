---
name: پوستر (Poster)
description: Persian-first event CRM and ticketing — cool paper surfaces, one neon sign.
colors:
  marquee-pink: "#e10e7c"
  marquee-pink-ink: "#cf0c73"
  blush-wash: "#ffe6f4"
  cool-paper: "#fdfcff"
  violet-ink: "#14101f"
  dusk-gray: "#5b5470"
  lilac-gray: "#71688d"
  lavender-wash: "#f4f1fb"
  lilac-rule: "#e8e3f2"
  lilac-rule-strong: "#d3cce6"
  glass: "rgba(255, 255, 255, 0.72)"
  field-paper: "#ffffff"
  field-rule: "#9e89c8"
  deep-green: "#08845a"
  deep-green-ink: "#077550"
  amber: "#a76607"
  amber-ink: "#935a06"
  signal-red: "#e02328"
  signal-red-ink: "#c51f23"
typography:
  display:
    fontFamily: "Vazirmatn Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Vazirmatn Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.4
  title:
    fontFamily: "Vazirmatn Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.5
  body:
    fontFamily: "Vazirmatn Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "Vazirmatn Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.25rem"
  full: "9999px"
spacing:
  tight: "0.5rem"
  snug: "0.75rem"
  base: "1rem"
  section: "1.25rem"
  block: "1.5rem"
  page: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.marquee-pink}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0 1.25rem"
    height: "2.75rem"
  button-primary-hover:
    backgroundColor: "{colors.marquee-pink}"
    textColor: "#ffffff"
  button-secondary:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.violet-ink}"
    rounded: "{rounded.md}"
    padding: "0 1.25rem"
    height: "2.75rem"
  button-ghost:
    textColor: "{colors.violet-ink}"
    rounded: "{rounded.md}"
    padding: "0 1.25rem"
    height: "2.75rem"
  card:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.violet-ink}"
    rounded: "{rounded.xl}"
    padding: "1.25rem"
  input:
    backgroundColor: "{colors.field-paper}"
    textColor: "{colors.violet-ink}"
    rounded: "{rounded.md}"
    padding: "0 0.875rem"
    height: "2.75rem"
  chip-selected:
    backgroundColor: "{colors.violet-ink}"
    textColor: "{colors.cool-paper}"
    rounded: "{rounded.full}"
    padding: "0.375rem 1rem"
  chip:
    textColor: "{colors.dusk-gray}"
    rounded: "{rounded.full}"
    padding: "0.375rem 1rem"
  badge-accent:
    backgroundColor: "{colors.blush-wash}"
    textColor: "{colors.marquee-pink-ink}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.625rem"
---

# Design System: پوستر (Poster)

## Overview

**Creative North Star: "Paper and Neon"**

Two materials and no third. Every surface is cool violet-tinted paper —
`#fdfcff` backgrounds, `rgba(255,255,255,0.72)` glass laid over a faint glow,
lilac hairline rules — and against that calm there is exactly one light source:
a hot pink that actually glows (`--glow: 0 0 24px -6px var(--accent)`). The
paper does the work of holding information. The neon does the work of telling
you where to press.

The restraint is what makes it read as professional rather than as an
entertainment site. Nothing here shouts except the one thing that is supposed
to. Hierarchy comes from weight, size and space; colour is reserved for meaning
— accent for action, and three semantic hues that appear only when something
succeeded, needs attention, or failed.

**Two audiences, one brand.** The organiser surfaces (dashboard, CRM, wizard,
finance, check-in, admin) spend the accent sparingly and lean on the paper:
someone is working there every day. The attendee surfaces (event page, checkout,
order confirmation, ticket wallet) let the neon and real imagery carry more —
someone is deciding whether to spend money on a night out, and treating them
like a data-entry operator reads as indifference. Same tokens, same Vazirmatn,
same accessibility floor; what differs is how much of the accent gets spent.

**Key Characteristics:**

- Persian-first and RTL by construction — logical properties only, never
  `left`/`right`
- Light theme only; there is no dark mode in the implementation
- One typeface, Vazirmatn Variable, doing display through caption
- Violet-tinted neutrals, never pure gray
- Glow instead of drop shadow as the primary depth cue
- Colour means something; it is never decoration

## Colors

A violet-leaning neutral field with a single saturated pink, plus three semantic
hues that are permitted only to report state.

### Primary

- **Marquee Pink** (`#e10e7c`): the brand fill. Primary button backgrounds, the
  focus ring, carousel position dots, selected accent states. Always paired with
  its glow — this colour is a light source, not a swatch.
- **Marquee Pink Ink** (`#cf0c73`): the same hue darkened for *text* on light
  surfaces, where the fill colour would not clear 4.5:1. Use for accent links
  and accent text on `Blush Wash`. Never use the fill value for body-size text.
- **Blush Wash** (`#ffe6f4`): the accent as a surface — selected chips, accent
  badges, soft emphasis panels. Carries `Marquee Pink Ink` as its foreground.

### Neutral

- **Cool Paper** (`#fdfcff`): the page. A near-white with a faint cool cast, not
  `#ffffff` — the difference is what stops large surfaces reading as clinical.
- **Violet Ink** (`#14101f`): primary text and the selected-chip fill. A
  violet-black rather than a true black, so it sits in the same family as the
  neutrals instead of punching a hole in them.
- **Dusk Gray** (`#5b5470`): secondary text — descriptions, list metadata,
  supporting copy.
- **Lilac Gray** (`#71688d`): captions and the least important line in a group.
  Darkened deliberately to clear AA on `Lavender Wash`.
- **Lavender Wash** (`#f4f1fb`): the subtle surface — hover fills, inset panels,
  skeleton blocks, the resting state of a ghost control.
- **Lilac Rule** (`#e8e3f2`) and **Lilac Rule Strong** (`#d3cce6`): hairline
  borders and their hover state. Borders carry structure here; shadows do not.
- **Glass** (`rgba(255,255,255,0.72)`): card and surface fill. Translucent on
  purpose, so the page's glow shows through and cards sit *in* the surface
  rather than on top of it.
- **Field Paper** (`#ffffff`) and **Field Rule** (`#9e89c8`): inputs are the one
  place that goes fully opaque white with a distinctly stronger border, because
  an editable region must read as editable at a glance.

### Semantic

- **Deep Green** (`#08845a`) / **Deep Green Ink** (`#077550`): succeeded, paid,
  issued, available.
- **Amber** (`#a76607`) / **Amber Ink** (`#935a06`): needs attention but nothing
  is lost — a pending payment, an expiring hold, a sharing warning.
- **Signal Red** (`#e02328`) / **Signal Red Ink** (`#c51f23`): failed, cancelled,
  sold out, destructive.

Each pair exists because the fill value does not clear AA as text on its own
10%-opacity tint. Use the `-ink` value for the words, the base value for the
wash behind them.

### Named Rules

**The One Sign Rule.** The accent fills exactly one control per screen — the
primary action — plus the focus ring. If a screen has two pink buttons, one of
them is not the primary action and should be `secondary` or `ghost`. Everything
else earns attention through weight and spacing.

**The Measured Contrast Rule.** Contrast here is verified, not estimated.
`tests/contrast.test.ts` and `tests/token-contrast.test.ts` assert the ratios,
and values have been rejected for dropping below 4.5:1 — `--faint` is darker
than it looks like it should be for exactly this reason. Never introduce a
colour pair without checking it, and never reach for `opacity-*` to soften text:
it dims whatever it lands on without knowing what that is, which is how a
session picker took accent text from 4.52 to 3.41.

**The Never-Gray Rule.** There are no neutral grays in this system. Every
neutral carries violet. A `#737373` dropped into this palette is immediately
visible as foreign.

## Typography

**Display / Body / Label Font:** Vazirmatn Variable (with `ui-sans-serif`,
`system-ui`, `sans-serif`)

**Character:** One family, self-hosted via `@fontsource-variable/vazirmatn` and
bundled at build time — there is no runtime font fetch. Vazirmatn is a
contemporary Persian sans with matching Latin, so mixed strings (a tracking code
beside Persian copy) hold one voice. The variable axis carries the whole
hierarchy; weight and size do all the work that a second family would otherwise
do.

### Hierarchy

- **Display** (700, `1.875rem`/`text-3xl`, tight): the city name on discovery,
  the largest page-level statement. Rare.
- **Headline** (700, `1.25rem`/`text-xl`, scaling to `text-2xl`): page titles —
  the event name at checkout, an error screen's heading.
- **Title** (700, `0.875rem`/`text-sm`): section headings inside cards
  («خلاصه سفارش», «مشخصات خریدار»). Deliberately small; the weight separates it,
  not the size.
- **Body** (400, `0.875rem`/`text-sm`, `leading-relaxed`): descriptions,
  explanations, list content.
- **Label** (500, `0.75rem`/`text-xs`, or `0.6875rem`/`text-[11px]` for the
  quietest line): metadata, captions, hints, timestamps.

### Named Rules

**The Persian Numerals Rule.** Every number a user reads is in Persian digits —
prices, counts, dates, times, seat numbers, countdowns. `formatNumber`,
`formatToman`, `formatJalaliDate` and `formatTime` in `lib/format.ts` own this.
A Latin numeral in the interface is a defect, and the failure is usually a
template literal that bypassed the helper.

**The Tabular Rule.** Anything that changes in place while a user watches it —
countdowns, prices, seat counts — is `tabular-nums`, so digits do not reflow as
they tick.

## Layout

Mobile-first and, for now, mobile-only: `components/DesktopGate.tsx` closes
every viewport at `1024px` and above. The `lg:` branches throughout the codebase
are unfinished desktop work rather than dead code, so build both and expect only
the narrow one to be reachable today.

**Containers.** `max-w-6xl` for wide surfaces (discovery, checkout), `max-w-3xl`
for reading, `max-w-lg` for single-column moments (error screens, order
confirmation). Horizontal padding steps `px-4` → `sm:px-6`.

**Page rhythm.** Vertical padding `py-8` → `sm:py-10` on content pages,
`py-12`–`py-20` on centred single-purpose screens. Sections separate with
`gap-6` to `gap-8`; content inside a card groups at `gap-4`–`gap-5`; tight pairs
at `gap-1.5`–`gap-2`.

**Two-column split.** Where a page has a working column and a summary, the grid
is `lg:grid-cols-[1fr_20rem]` with the aside `lg:sticky lg:top-6`.

**Horizontal rails.** Carousels and chip rows bleed to the viewport edge with
`-mx-4 … px-4` and snap (`snap-x`), returning to a contained row at `sm`.

### Named Rules

**The Logical Property Rule.** `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`,
`end-*`, `text-start`, `text-end`, `border-s`, `border-e`. Never `ml`, `mr`,
`pl`, `pr`, `left`, `right`, `text-left`, `text-right`. This is the single most
cross-cutting rule in the codebase and it is currently held at zero violations
across the attendee path.

## Elevation & Depth

**Glow, not drop shadow.** Depth here is mostly light. The signature is
`--glow: 0 0 24px -6px var(--accent)` — a coloured halo under accent elements
that reads as illumination rather than as a raised object. Ordinary separation
is carried by hairline `Lilac Rule` borders and by the translucency of `Glass`
surfaces, which let the page tint through.

Conventional shadows exist but stay quiet: `shadow-sm` on secondary controls,
`shadow-lg` on the buy box and popovers, each offset and softly blurred rather
than a flat halo.

### Shadow Vocabulary

- **Accent glow, resting** (`0 0 24px -4px var(--accent)`): under a primary
  button at rest.
- **Accent glow, hover** (`0 0 32px -2px var(--accent)`): the same light,
  brighter and wider on hover.
- **Accent glow, invitation** (`0 0 18px -6px var(--accent)`): a secondary
  control on hover, hinting at the accent without adopting it.
- **Ambient lift** (`shadow-sm`, `shadow-lg`): structural separation for
  floating surfaces — the buy box, dropdowns, the seat panel.

### Named Rules

**The Halo-Is-Accent-Only Rule.** A zero-offset coloured glow belongs to the
accent and nothing else. Neutral surfaces separate with a border or a real
offset shadow; a glow around a gray card is decoration pretending to be depth.

## Shapes

Generously rounded, and the radius encodes scale. Controls are `rounded-md`
(`0.75rem`); cards and panels are `rounded-xl` (`1.25rem`) on the attendee
surfaces and `rounded-lg`/`rounded-xl` inside them; pills — chips, badges,
avatars, the search field, position dots — are fully round (`rounded-full`).
HeroUI components read their own `--radius: 0.6rem`.

Borders are hairlines: `1px` in `Lilac Rule`, strengthening to `Lilac Rule
Strong` or `Marquee Pink` on hover. Empty states use the same hairline dashed
(`border-dashed`) rather than a filled placeholder.

### Named Rules

**The One Radius Per Journey Rule.** A single flow uses one card radius from
start to finish. Checkout previously drifted `rounded-2xl` → `rounded-xl` →
`rounded-lg` across three screens of one purchase, which reads as three
different products.

## Components

### Buttons

Confident and slightly physical — they light up rather than lift.

- **Shape:** rounded (`rounded-md`, `0.75rem`)
- **Sizes:** `sm` 2.25rem / `md` 2.75rem / `lg` 3.25rem tall, padding `1rem` /
  `1.25rem` / `1.75rem`
- **Primary:** `Marquee Pink` fill, white text, resting accent glow. Hover
  brightens (`brightness-110`) and widens the glow; active nudges down 1px.
- **Secondary:** `Glass` fill, `Violet Ink` text, `Lilac Rule` border,
  `shadow-sm`. Hover swaps the border to accent and adds the invitation glow.
- **Ghost:** text only; hover fills with `Lavender Wash`.
- **Focus:** `ring-2` in `Marquee Pink` with `ring-offset-2` against the
  background — visible on every variant, never removed.
- Non-button elements that must look like buttons (a `next/link`) use
  `buttonVariants` from `components/ui/button-variants.ts`, a server-safe recipe
  module. Never hand-roll button classes.

### Chips

- **Style:** fully round, `1px` border, `0.875rem` text
- **Unselected:** `Dusk Gray` text on transparent, `Lilac Rule` border; hover
  strengthens the border and darkens the text
- **Selected:** `Violet Ink` fill with `Cool Paper` text — inverted, not pink.
  The accent is reserved for the primary action, not for filter state.
- Carries `aria-pressed`, not just a colour change

### Cards / Containers

- **Corner:** `rounded-xl` (`1.25rem`), up to `rounded-2xl` for hero surfaces
- **Background:** `Glass` — translucent, so the page glow reads through
- **Border:** `1px` `Lilac Rule`
- **Shadow:** none at rest; `shadow-lg` only on genuinely floating surfaces
- **Padding:** `1.25rem` (`p-5`) standard, `2rem` (`p-8`) for centred
  single-purpose panels

### Inputs / Fields

- **Style:** opaque `Field Paper` white on a `Field Rule` border — deliberately
  stronger than a card border so an editable region is obvious
- **Height:** 2.75rem; search fields are `rounded-full`, form fields
  `rounded-md`
- **Focus:** border shifts to `Violet Ink` with a soft `ring-2` at 15% accent
- **Error:** message sits adjacent to the field, `Signal Red Ink`, with
  `role="alert"` when it renders away from the control that triggered it
- **16px minimum font size** on inputs — iOS Safari force-zooms anything smaller
  and breaks the layout

### Navigation

- **Public header:** `Glass` bar, hairline bottom border, logo at the start,
  ghost-button links, account slot at the end holding its width while the
  session resolves
- **Signed-in mobile chrome:** a fixed top bar plus bottom tab nav on main
  routes; a back bar on second-level pages. Page-level headers opt out via
  `.auth-mobile-hide` so they never stack under it
- **Active state:** weight and colour, not an underline

### Signature: the seat map

The product's most distinctive surface. Progressive by construction — venue
overview, then a chosen section's seats on a canvas overlaid in place, with
other sections dimmed so spatial context never breaks. Seat controls are real
`option` elements carrying fully composed Persian accessible names (section,
row, seat, price, status in one string), a wheelchair-and-companion filter is a
first-class control, and a live hold countdown turns urgent below two minutes.
Treat it as the reference for how much care an interactive surface here earns.

## Do's and Don'ts

### Do:

- **Do** spend the accent on exactly one control per screen (The One Sign Rule),
  plus the focus ring.
- **Do** use logical properties everywhere — `ms`/`me`/`ps`/`pe`/`start`/`end`.
- **Do** render every user-facing number through `lib/format.ts` so it arrives in
  Persian digits.
- **Do** use `tabular-nums` for any figure that updates in place.
- **Do** reach for `buttonVariants` when a link must look like a button.
- **Do** pair a semantic colour's `-ink` value with its 10% wash — the base fill
  is not an AA text colour.
- **Do** verify contrast against the test suite before introducing a colour pair.
- **Do** keep one card radius for the length of a single user journey.

### Don't:

- **Don't** introduce a neutral gray. Every neutral in this system carries
  violet (The Never-Gray Rule).
- **Don't** use `opacity-*` to soften text — it silently destroys contrast on
  whatever it lands on.
- **Don't** put a coloured glow on anything that is not the accent.
- **Don't** use `#ffffff` for a page background; the page is `Cool Paper`.
- **Don't** fill a filter chip with pink to show selection — selected chips
  invert to `Violet Ink`.
- **Don't** add a dark-mode branch. This system is light-only; a `dark:` variant
  today is untested surface area.
- **Don't** build a bespoke control where HeroUI or `components/ui` already has
  one, and don't add new files to `components/ui` — it holds thin HeroUI
  wrappers only.
- **Don't** ship English in the interface, including strings generated at
  runtime by the browser.
