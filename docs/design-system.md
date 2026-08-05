# Design System

**Paper and neon.** Every surface is cool violet-tinted paper; against it there
is exactly one light source, a hot pink that glows. `DESIGN.md` at the
repository root is the authoritative brand specification; this document maps it
onto the implemented tokens in `app/globals.css` and records the contrast audits
that constrain any change to them.

The restraint is what makes it read as professional rather than as an
entertainment site. Hierarchy comes from weight, size and space; colour is
reserved for meaning — the accent for action, three semantic hues for
succeeded / needs attention / failed.

**Light theme only.** There is no dark token set. Earlier revisions of this file
described a monochrome black-and-white palette with an Info-blue accent and a
`prefers-color-scheme` dark mode; none of that is in `app/globals.css` and none
of it ever shipped.

**Two audiences, one brand.** Organiser surfaces (dashboard, CRM, wizard,
finance, check-in, admin) spend the accent sparingly and lean on the paper.
Attendee surfaces (event page, checkout, order, ticket wallet) let the neon and
real imagery carry more. Same tokens, same accessibility floor; what differs is
how much accent gets spent.

## Color roles

Every color is a CSS custom property. The ones the owned primitives use are
mapped to Tailwind via `@theme inline` (`--color-background` → `bg-background`);
HeroUI reads its own set of raw variables from the same block, which is what
carries the brand into every HeroUI component without per-component theming.

| Role | Token | Value |
| --- | --- | --- |
| Page background (Cool Paper) | `--background` | `#fdfcff` |
| Foreground (Violet Ink) | `--foreground` | `#14101f` |
| Secondary text (Dusk Gray) | `--muted` | `#5b5470` |
| Captions (Lilac Gray) | `--faint` | `#71688d` |
| Subtle surface (Lavender Wash) | `--subtle` | `#f4f1fb` |
| Border (Lilac Rule) | `--border` | `#e8e3f2` |
| Border strong / hover | `--border-strong` | `#d3cce6` |
| Card surface (Glass) | `--card` | `rgba(255,255,255,0.72)` |
| Brand fill (Marquee Pink) | `--accent` | `#e10e7c` |
| Accent as text | `--accent-text` | `#cf0c73` |
| Accent surface (Blush Wash) | `--accent-soft` | `#ffe6f4` |
| Success / warning / danger | `--success` `--warning` `--danger` | `#08845a` `#a76607` `#e02328` |
| The same, as text | `--success-text` `--warning-text` `--danger-text` | `#077550` `#935a06` `#c51f23` |
| Focus ring | `--ring` | `#e10e7c` |
| Glow | `--glow` | `0 0 24px -6px var(--accent)` |
| Field surface / edge | `--field-background` `--field-border` | `#ffffff` `#9e89c8` |

HeroUI-only tokens mapped to the brand in the same file: `--surface`,
`--overlay`, `--default`, `--segment`, `--separator`, `--focus`, `--radius`, and
the `--field-*` set.

Usage notes:

- **Pink is the brand, and it is a light source.** Primary buttons, the focus
  ring, selected states. Always with its glow; never as body-size text.
- **Fill tones and text tones are different values.** `--accent` for fills,
  rings and indicators; `--accent-text` for words. Same split for the three
  semantic hues — see *Status colours as text* below for the measurements that
  forced it.
- **Neutrals are violet-tinted, never pure gray**, and the page is `#fdfcff`
  rather than `#ffffff` — the difference is what stops a large surface reading
  as clinical.
- **`muted`** is secondary text, **`faint`** is captions; body copy stays on
  `foreground`.
- **Depth is glow and hairline borders, not drop shadow.** Cards are
  translucent so the page's glow shows through: they sit *in* the surface
  rather than on top of it.
- **Inputs are the one opaque white surface**, with a distinctly stronger
  border, because an editable region must read as editable at a glance.

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

## Elevation and depth

Depth is carried by the glow and by hairline borders, not by drop shadow.
Stacking reads as: page background → `subtle` panels → translucent `card`
surfaces → opaque overlays. Popovers, menus and modals go opaque (`--overlay`)
rather than glass, because readability beats atmosphere the moment text lands on
top of arbitrary content.

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
- **Contrast:** every pairing below is computed from the tokens rather than
  judged by eye, and asserted by `tests/contrast.test.ts` and
  `tests/token-contrast.test.ts`. Verify any new pairing, especially text on
  `muted`/`faint` and on `accent-soft`.
- **RTL:** mirror layout, not glyphs that must stay stable (for example logos
  and Persian numerals). Test every view in RTL as the primary case.

## Components

**HeroUI is the component library.** Buttons, inputs, selects, modals, tabs,
tables, cards, chips, tooltips and menus all come from `@heroui/react`; do not
hand-roll a styled `<div>`/`<button>` for something it already covers, and do
not add new files under `components/ui`.

`components/ui` holds **thin wrappers only** — they exist so existing call sites
keep a native-style API (`onClick`, `e.target.value`, `disabled`) over HeroUI's
React Aria handlers (`onPress`, value-based `onChange`, `isDisabled`). Pure
helpers that a Server Component needs live in a separate non-client module;
`components/ui/button-variants.ts` is the example.

The button recipe is three variants — **primary** (accent fill with its glow,
one per view), **secondary** (glass surface with a border), **ghost**
(transparent, subtle hover fill) — at **sm / md / lg** (36 / 44 / 52 px), all on
`--radius-md` with a focus ring on `--ring`.

Two brand-specific components sit outside HeroUI because they encode a product
decision rather than a control: `components/workspace/WorkspaceAvatar.tsx`
(uploaded logo, or a default icon — deliberately **no initials fallback**, which
produced «سس» for a two-word Persian name) and `WorkspaceBanner.tsx` (uploaded
cover, or an on-brand gradient seeded deterministically by the slug).

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
