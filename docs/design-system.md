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
- **Direction: RTL, Persian only.** All layout, alignment, and iconography
  assume right-to-left; product-facing copy and numerals are Persian. See the
  RTL & Persian-first rule in `CLAUDE.md`.
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

## Contrast (audited)

Every pair below is computed from the tokens in `app/globals.css`, not judged by
eye. Text needs 4.5:1 (WCAG 1.4.3); control boundaries and the focus ring need
3:1 (1.4.11).

| Pair | Ratio | Needs |
| --- | --- | --- |
| `--foreground` on `--background` | 18.28 | 4.5 |
| `--muted` on `--background` | 6.97 | 4.5 |
| `--faint` on `--subtle` (worst case) | 4.63 | 4.5 |
| `--accent-text` on `--background` | 5.20 | 4.5 |
| `--accent-text` on `--accent-soft` | 4.52 | 4.5 |
| white on `--accent` (primary button) | 4.61 | 4.5 |
| `--success` / `--warning` / `--danger` as text | 4.61 / 4.52 / 4.63 | 4.5 |
| white on those same fills | 4.71 / 4.62 / 4.73 | 4.5 |
| `--field-placeholder` on `--field-background` | 4.52 | 4.5 |
| `--field-border` on `--field-background` | 3.06 | 3.0 |
| `--ring` on `--background` | 4.51 | 3.0 |

Two decisions are worth knowing before changing a colour:

**`--accent` and `--accent-text` are different pinks.** A fill and a text colour
have different jobs. The fill only has to carry a white label (4.5:1 against
white); text has to be legible on the page *and* inside an `--accent-soft` chip,
which is a stricter constraint. Using one value for both forced a choice between
a washed-out brand and unreadable links. Use `text-accent-text` for accent-
coloured text and `--accent` for fills, rings and indicators.

**`--field-border` is darker than `--border`.** 1.4.11 governs boundaries you
have to find and operate, so inputs get a 3:1 edge. The hairline between cards
is decoration and stays light — applying 3:1 there would turn every card into a
boxed table.

The audit is reproducible: the ratios come straight from the token values, so
re-running it after a palette change is arithmetic, not opinion.

## Readability (audited)

Contrast is only half of legibility. These were checked across every page:

| Check | Finding | Action |
| --- | --- | --- |
| Text under 12px | 12 uses of 10–11px | 10px tag counts raised to 11px |
| RTL correctness | 6 physical `left`/`right`/`pr` in interactive UI | Converted to `start`/`end`/`ps` |
| Touch targets | Seat buttons ~28px tall | Raised to 44×44 |
| Line length | Prose capped at `max-w-[40rem]`–`44rem` | No change needed |

**Persian needs more size than Latin.** Vazirmatn at 10px loses the dot and
diacritic detail that distinguishes ب/پ/ت. 11px is the practical floor for
Persian text and 12px the comfortable one. One 10px use survives — the `V`/`R`/`P`
keyboard hints in the venue designer, which are single Latin capitals in an
internal tool, not Persian prose.

**Logical properties are not cosmetic here.** The physical `left`/`right` uses
found in the select chevron and the check-in search field produced the *right*
result, but only because `<html dir="rtl">` is hardcoded. They said "left" and
meant "the end of the line". Anything that reads or positions along the text
axis uses `start`/`end`/`ps`/`pe`. Decorative absolute placement — the hero
illustration's floating cards — legitimately stays physical: it is an
arrangement of art, not a line of text.

**Seat buttons are the exception that justified the 44px rule.** They were
about 28px tall, above the 24px WCAG 2.5.8 floor but well below comfortable.
Seat-picking on a phone is precisely where a mis-tap costs a sale — it either
selects the wrong seat or takes a hold on it — so density gave way to
reliability.

## Control boundaries (WCAG 1.4.11)

Audited by computing every pairing rather than by eye; the script lives in the
session scratchpad and the numbers below are reproducible from the tokens in
`app/globals.css`.

**The finding.** `--border` (`#e8e3f2`) is **1.26:1 on white**. That is correct
for what it is — a divider tint on a deliberately light brand — and wrong for
what it was being used for: the edge of text inputs, selects, textareas, and the
date/time fields. On an *empty* input the border is the only thing that says a
control is there, so 1.4.11's 3:1 applies and was not met.

`--field-border` (`#9e89c8`, **3.06:1**) already existed for the HeroUI half of
the system and was tuned for exactly this. The owned primitives now use it too,
surfaced as `--color-field-border` so both halves draw a field the same way.
Hover moved from `border-border-strong` (1.55:1) to `foreground/50` (3.50:1).

**Buttons deliberately keep `--border`.** 1.4.11 asks for 3:1 on the visual
information *required to identify* a control. A button's label carries that —
the stepper's glyphs are 18.69:1 — so its boundary is decoration, not
identification. Changing every button border would darken the whole UI to
satisfy a rule it already meets.

### The light-on-light trap

`--accent-soft` is **1.15:1** against `--background`. A tinted panel therefore
communicates nothing on its own: the "best available" panel was first drawn with
`bg-accent-soft/40` and a `border-accent/30` edge, which measured 1.06:1 and
1.63:1 — a highlighted call-to-action that was invisible. On this brand, surface
tint is atmosphere and **the border is the signal**. It now uses the full soft
fill with `border-accent/60` (2.55:1).

| Pairing | Ratio | Needs |
| --- | --- | --- |
| foreground / accent-soft | 15.91 | 4.5 |
| muted / accent-soft | 6.07 | 4.5 |
| accent-text / accent-soft | 4.52 | 4.5 |
| accent-foreground / accent | 4.61 | 4.5 |
| danger / card | 4.73 | 4.5 |
| muted / subtle | 6.39 | 4.5 |
| field-border / card | 3.06 | 3.0 |
| accent (chip state) / card | 4.61 | 3.0 |
| QR black / white | 21.00 | — |

Three of these clear AA by under 0.15 (`accent-text` on soft at 4.52,
`accent-foreground` on accent at 4.61, `danger` on card at 4.73). They pass, but
they are the first things any future palette change will break.

## Status colours as text

The same split as `--accent` / `--accent-text`, for the same reason and found
the same way.

`--danger`, `--warning` and `--success` are tuned against white — white on
danger is 4.73:1 — but the house pattern for a callout is coloured text on a
**10% tint of its own colour**, and that tint darkens the background just far
enough to drop the text below AA:

| Callout | Was | Now |
| --- | --- | --- |
| danger on `bg-danger/10` | 4.05 | 5.00 |
| warning on `bg-warning/10` | 4.07 | 5.00 |
| success on `bg-success/10` | 4.13 | 5.02 |

Twenty-seven callouts across fifteen files, none of them new — the pattern
predates this audit. `--danger-text` / `--warning-text` / `--success-text` are
the same hues darkened to clear **5:1 on their own tint**, deliberately not
4.5:1: three existing pairings already sit within 0.15 of the boundary and a
fourth set that only just cleared would be broken by any future palette nudge.

The fills are untouched. A red button is still red; only text on a tinted
surface changes.

## Contrast the audit cannot reach

Every ratio recorded above was computed from a token — a colour that exists in
`app/globals.css` and can be checked once. The ticket designer breaks that
model: an organiser picks `accent` and `bgColor` freely, while the body text
colour follows a *separate* light/dark `surface` switch. Nothing stopped
`surface: "light"` (near-black text) over a near-black `bgColor`, which produces
a ticket that cannot be read at a door.

No token audit can catch that, because the colours do not exist until someone
types them. `lib/contrast.ts` is the same arithmetic as the audit script, made
into a tested module so the check can run where the choice is made. The designer
grades the pairing live and **warns rather than blocks** — it is the organiser's
brand, and they may have a reason; what they must not do is ship an unreadable
ticket without being told.

Three verdicts, because two would lie: `pass` (≥4.5), `large-only` (≥3, which
saves the event title and loses the seat number), and `fail`. A background
*image* is not graded at all — its contrast varies pixel to pixel, and one
number would be a guess.

`lib/contrast.ts` is verified against the spec's fixed points (21:1 and 1:1),
against the token ratios in this document, and on both sides of the sRGB linear
cutoff at channel 10.016/255 — the branch a naive implementation gets wrong.

## The whole palette, audited

Previous passes checked whichever component was being touched. This one
enumerates every colour token used as text anywhere in `app/` and `components/`
and grades it against every surface it can land on. Reproducible from the tokens
in `app/globals.css`.

| token | background | card | subtle | uses |
| --- | --- | --- | --- | --- |
| `foreground` | 18.28 | 18.69 | 16.75 | 325 |
| `muted` | 6.97 | 7.13 | 6.39 | 312 |
| `faint` | 5.05 | 5.16 | 4.63 | 154 |
| `danger-text` | 5.72 | 5.84 | 5.24 | 76 |
| `accent-text` | 5.20 | 5.31 | 4.76 | 34 |
| `success-text` | 5.60 | 5.72 | 5.13 | 31 |
| `warning-text` | 5.54 | 5.67 | 5.08 | 9 |

Everything clears AA on every surface it can appear on.

### Fill tones are not text tones

`--danger`, `--success` and `--warning` are tuned for white-on-fill and measure
**4.14–4.24 on `--subtle`** — below AA. They were being used as text in 66
places, and whether any given one was legible depended on which surface its
parent happened to have.

The rule is now uniform: **fill tones for backgrounds and borders, `-text` tones
for text.** Normalising 36 files removes the whole class rather than the
instances that happened to be co-located with a `bg-` class in the same
`className` — which is all a static check can see.

### Two tokens exempt, and why

`--background` and `--accent-foreground` measure 1.00–1.12 against page
surfaces, which looks alarming in a matrix and is meaningless: they are
white-on-dark tokens. Verified rather than assumed — all 38 uses sit on
`bg-foreground` (18.28:1) or `bg-accent` (4.61:1).

### Non-text

A video thumbnail's play icon was white on a `foreground/20` scrim: **1.55:1**
over a bright frame, effectively invisible. Icons need 3:1 under 1.4.11 and the
backdrop is arbitrary video, so the scrim has to carry it alone. At `/50` a
white glyph holds 3.5:1 even over a pure-white frame.

## Readability, beyond contrast

### RTL — clean

CLAUDE.md calls this the most cross-cutting rule in the codebase, so it was
worth measuring rather than trusting. Across `app/` and `components/` there are
**five** physical direction utilities, all in `HeroIllustration.tsx`, all
positioning decorative cards around a hero image. Everything else uses
`ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`. Left alone deliberately: whether a
decorative composition should mirror is a design judgement, not a correctness
one, and it cannot be made without looking at it.

### Opacity is a contrast multiplier that nothing accounts for

`opacity-75` dims whatever colour it lands on without knowing what that is. On
the checkout سانس picker — a button with three colour states — the line reading
**«ساعت ۱۸:۰۰»** measured:

| state | full | at 75% |
| --- | --- | --- |
| selected (`accent-text` on `accent-soft`) | 4.52 | **3.41** |
| unselected (`foreground` on `card`) | 18.69 | 8.39 |
| closed (`faint` on `subtle`) | 4.63 | **2.93** |

Two of three below AA, on the line that says what time the show starts. Removed:
the step from `text-sm` to `text-xs` already carries the hierarchy.

Every other reduced-opacity instance is `disabled:` or a sold-out section, both
of which WCAG exempts.

### Type and targets

The scale is `text-sm` (325 uses) and `text-xs` (243) with a handful of larger
sizes. One `text-[10px]` existed — off the scale entirely, and at
`opacity-60` — now `text-[11px]` at `opacity-70` (6.96:1).

Buttons are 36 / 44 / 52 px. The smallest clears WCAG 2.5.8 (AA, 24 px) though
not 2.5.5 (AAA, 44 px), which is a reasonable trade for a dense dashboard. No
bare `<button>` anywhere is under 24 px.
