# Design Guidelines

> **Brand Principles**
>
> Simple. Professional. Timeless.
>
> We are building an **Event CRM**, not an event marketplace. Every design decision should reinforce trust, clarity, and productivity.

---

# Design Philosophy

The product should feel like software professionals use every day.

Inspired by:

- Linear
- Notion
- Vercel
- Stripe Dashboard
- Apple

Avoid designs that resemble:

- Event marketplaces
- Entertainment websites
- Consumer-focused ticketing apps
- Marketing-heavy landing pages

The interface should communicate:

- Trust
- Simplicity
- Focus
- Confidence
- Professionalism

---

# Design Principles

## Minimal First

Every element must have a purpose.

If something does not improve usability, remove it.

---

## Content First

Typography is the primary visual element.

Spacing should create hierarchy rather than colors.

---

## Plenty of White Space

The UI should breathe.

Do not attempt to fill empty space.

Whitespace improves comprehension.

---

## Calm Interface

Avoid visual noise.

Prefer:

- thin borders
- subtle shadows
- clean layouts
- neutral colors

---

## Consistency

Every page should feel like it belongs to the same product.

Reuse spacing, typography, components and interaction patterns.

---

# Color System

## Brand

Primary colors are monochrome.

```text
Black     #111111
White     #FFFFFF
```

---

## Neutral Palette

```text
950  #0A0A0A
900  #111111
800  #1F1F1F
700  #2F2F2F
600  #525252
500  #737373
400  #A3A3A3
300  #D4D4D4
200  #E5E5E5
100  #F5F5F5
50   #FAFAFA
```

---

## Semantic Colors

Only use colors to communicate meaning.

```text
Success  #16A34A
Warning  #D97706
Danger   #DC2626
Info      #2563EB
```

Never use semantic colors as branding colors.

---

# Typography

## Font

Use **Vazirmatn** exclusively.

No other Persian font should be used.

---

## Font Weight

| Usage | Weight |
|--------|--------|
| Hero | 700 |
| Section Titles | 700 |
| Card Titles | 600 |
| Body | 400 |
| Captions | 400 |

---

## Text Color

Primary

```text
#111111
```

Secondary

```text
#525252
```

Muted

```text
#A3A3A3
```

---

# Border Radius

Use large rounded corners.

| Component | Radius |
|------------|--------|
| Button | 12px |
| Input | 12px |
| Card | 16px |
| Modal | 20px |
| Dialog | 20px |

Avoid sharp corners.

---

# Shadows

Use shadows sparingly.

Preferred:

```css
box-shadow:
0 1px 2px rgba(0,0,0,.04);
```

Hover

```css
0 8px 24px rgba(0,0,0,.08);
```

Avoid large blurry shadows.

---

# Borders

Default border

```text
#E5E5E5
```

Hover

```text
#D4D4D4
```

Active

```text
#111111
```

---

# Layout

Maximum content width

```text
1280px
```

Reading width

```text
720px
```

Dashboard content

```text
1440px
```

---

# Spacing

Use an 8-point grid.

```text
4
8
12
16
24
32
40
48
64
80
96
128
```

Never use arbitrary spacing values.

---

# Buttons

Primary

- Black background
- White text

Secondary

- White background
- Black border

Ghost

- Transparent

Destructive

- Red

Disabled

- 50% opacity
- Cursor not-allowed

---

# Cards

Cards should be flat.

Background

```text
White
```

Border

```text
#E5E5E5
```

No heavy elevation.

---

# Forms

Inputs should feel spacious.

Height

```text
48px
```

Border

```text
1px
```

Radius

```text
12px
```

Placeholder should never replace labels.

Always display labels.

---

# Icons

Use

**Lucide React**

Stroke icons only.

2px stroke.

Do not mix icon libraries.

---

# Motion

Animations should be subtle.

Preferred:

- Fade
- Slide
- Scale
- Opacity

Duration

```text
150-250ms
```

Never animate large distances.

Avoid bounce animations.

---

# Illustrations

Avoid stock illustrations.

Prefer:

- geometric shapes
- abstract dashboards
- wireframes
- minimal diagrams

---

# Images

Rounded corners.

No excessive gradients.

No fake device mockups.

---

# Landing Pages

Structure

- Header
- Hero
- CTA
- Footer

Keep pages concise.

---

# Dashboard

The dashboard should feel like a professional CRM.

Prioritize:

- tables
- filters
- analytics
- clarity

Not decoration.

---

# Accessibility

Always support:

- Keyboard navigation
- Screen readers
- Focus states
- ARIA labels
- High contrast

Never rely on color alone.

---

# Responsive

Design mobile first.

Breakpoints

```text
sm
md
lg
xl
2xl
```

Components should gracefully resize.

---

# RTL

Everything is RTL.

Never mix LTR layouts unless displaying:

- URLs
- Emails
- Numbers
- Code
- IDs

---

# Component Philosophy

Components should be:

- Small
- Reusable
- Predictable
- Stateless when possible

Avoid giant components.

---

# Tone

The interface should feel:

- Quiet
- Professional
- Elegant
- Modern
- Reliable
- Purposeful

Never playful.

Never flashy.

Never gimmicky.

---

# Brand Keywords

- Event CRM
- Professional
- Reliable
- Enterprise
- Business
- Clean
- Minimal
- Modern
- Calm
- Premium

---

# Rule

Whenever there is uncertainty between making something **beautiful** or **simple**, choose **simple**.

Whenever there is uncertainty between adding a feature or reducing cognitive load, reduce cognitive load.

Great software disappears behind the user's workflow.
