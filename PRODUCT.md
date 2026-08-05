# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Mobile web. `components/DesktopGate.tsx` (wired at `app/layout.tsx`) closes every
viewport at or above `1024px` behind «نسخهٔ دسکتاپ هنوز آماده نیست», so the only
experience anyone can currently reach is a phone-width one.

**This is a launch constraint, not the product.** Desktop is planned. The `lg:`
branches throughout `app/` and `components/` are unfinished desktop work, not
dead code, and future work must keep building both — while knowing that only the
mobile branch is presently reachable or testable.

## Users

Two audiences, and the product serves them in sequence rather than equally.

**Attendees** — Persian-speaking people in Iran deciding whether to go to
something, then buying a ticket for it. On a phone, often from an SMS or a
shared link, sometimes with poor connectivity, sometimes standing at a venue
door with none. They arrive with intent ("I have a ticket for tonight") or
without it ("what is on this weekend?"), and the product must answer both.

**Organisers** — teams that run events as part of how they operate: event and
production companies, conference organisers, universities, sports clubs,
communities and meetups, workshop providers, exhibitions, government bodies,
NGOs. The common thread is a repeat operator managing capacity, money, staff,
and an ongoing relationship with attendees — not a one-time seller.

Organisers work inside a **workspace**; membership carries a `WorkspaceRole`,
and individual events can carry per-event collaborators (`EventCollabRole`,
defaulting to co-host). There is no global role column on a user: becoming an
organiser is one insert.

### Current stage

Attendee experience first, organiser CRM second. The front door reflects it —
`next.config.ts` redirects `/` to `/events`, discovery rather than a marketing
page. This is the sequencing of the current stage, not a permanent ranking of
who matters.

## Product Purpose

Give event organisers in the Persian-speaking market one professional platform
for the full lifecycle of an event: plan it, sell tickets for it, understand the
people who attend, and grow that relationship over time.

Poster replaces the scattered toolset organisers cobble together today —
spreadsheets, ad-hoc payment links, messaging apps, paper guest lists — with one
system of record.

Success is an organiser running their next event on Poster because the audience
from the last one is already there.

## Positioning

**A CRM for events, where the attendee is the asset.** Ticketing is one
capability inside it, not the whole product.

The insight a neighbouring product cannot truthfully copy without rebuilding
around it: every ticketing tool ends the relationship at checkout. The valuable
thing an organiser accumulates over years is not a pile of transactions, it is
an audience — who came, how often, what they bought, which segment they belong
to, and how to reach them again. Selling a ticket is the event that creates or
enriches a contact record, and marketing, operations, analytics and finance hang
off that record.

Poster is **not** an event marketplace, and **not** a concert-discovery or
entertainment site.

## Operating Context

- **Iran.** Money is Iranian Toman. Payment runs through Zarinpal
  (`PAYMENT_PROVIDER`; a mock gateway exists for development and production
  refuses to fall back to it). Messaging runs through Kavenegar or sms.ir.
- **Persian-first and RTL.** The document is `<html lang="fa" dir="rtl">`. All
  user-facing copy and all numerals are Persian. English appears only in code
  and documentation.
- **Dates are Jalali** to the user and ISO 8601 on the wire. Event times are
  pinned to `Asia/Tehran` rather than the viewer's zone — an organiser who types
  18:00 means 18:00 at the venue.
- **The venue door is a real environment.** A ticket has to render and be
  accepted with no signal: the QR is drawn client-side from a token already in
  hand, the order code is accepted by hand as a fallback, and door scanning uses
  the browser's native `BarcodeDetector` rather than a shipped decoder.
- **SMS is a primary channel**, not a notification nicety. Tickets, tracking
  codes and order confirmations reach buyers by SMS, and many buyers arrive at
  the product from a link in one.

## Capabilities and Constraints

**Events.** One-time, recurring, and multi-session (`سانس`). Sessions carry
their own availability state. Visibility is `public`, `link`-only, or
`audience` (targeted at a CRM segment).

**Ticketing.** Unlimited ticket types per event, each with price (integer
Toman), capacity, a sales window, and a category (general, VIP, student,
early-bird, backstage, group). Assigned seating is supported via pinned venue
seat maps with real server-side seat holds; open seating sells on capacity
alone. A session may sell both at once — numbered seats in the stands and a
standing quantity on the floor.

**Two clocks, deliberately different.** A seat hold lasts 20 minutes
(`SEAT_HOLD_MINUTES`); the order it becomes lasts 15 (`HOLD_MINUTES`). Both are
real and both are surfaced to the buyer.

**Free events are listings, not purchases.** When every ticket type is free the
product states what is happening and where, and the visitor turns up. No order,
no ticket, no reservation ceremony. (A *mixed* event with a free tier beside a
paid one is a paid event and still goes through checkout.)

**A discount never takes an order to zero.** Discounts are clamped to leave at
least the gateway's minimum payable, because a zero total settles an order
in-process and skips payment entirely.

**Also built:** waitlists, organiser-approval registration, discount codes with
redemption caps, door check-in, refunds, payouts and finance, attendee CRM with
tags and segments, campaigns and notifications, workspace and collaborator
management, organiser public pages, and a platform-admin surface for venues and
payouts.

**Terminology (Persian, load-bearing).** `سانس` a session/showing · `بلیت` a
ticket · `کد پیگیری` the order tracking code · `لیست انتظار` the waitlist ·
`ورود آزاد` free entry · `میزبان` the host/organiser. Use one word per concept.

**Open decisions.** Whether a free *tier* inside a paid event should also bypass
ticketing is undecided. Whether the server should refuse free-event orders
outright — the UI path is closed, the API still accepts them — is undecided, and
depends on what happens to free orders already in the database.

## Brand Commitments

- The product is **پوستر (Poster)**.
- **Vazirmatn** is the typeface, self-hosted, and no other Persian font is used.
- Persian-first is not a localization layer; it is the product. Latin numerals,
  untranslated strings, and physical-direction CSS (`left`/`right` rather than
  `start`/`end`) are defects.
- The organiser surfaces and the attendee surfaces are deliberately allowed to
  feel different — calm and dense for people working, warmer for people
  deciding. Recorded in `DESIGN.md`; named here because it is a product stance
  about two audiences, not only a visual one.

## Evidence on Hand

**Pre-launch. Nothing is real yet.**

- No real organisers, events, attendees, or transactions. Everything visible is
  fixtures from `prisma/seed-data.ts` (19 events, venues, sessions, ticket
  types). Their ids are load-bearing — tests reference them by hand.
- Search engines are blocked deliberately: `app/robots.ts` disallows all
  crawlers and the root layout sets `robots: { index: false }`. Both need
  flipping at launch.
- Production carries no real data.

Future work must not invent customers, testimonials, attendance figures, press,
partnerships, or pricing. There are none to cite.

## Product Principles

1. **The attendee is the asset.** Anything that ends the relationship at
   checkout is a step backwards, however convenient.
2. **Never quote a number the server will not honour.** Prices, totals, and
   availability shown to a buyer are a preview of a server decision; when the
   client cannot know, it says so rather than guessing.
3. **State what is true, including when it is bad.** Holds expire, payments
   fail, shows get cancelled. The product names the situation and the recovery
   instead of hiding it or promising more than it knows.
4. **The failure case is the product.** A ticket at a door with no signal, a
   gateway that never returns, a payment that half-succeeded — these are normal
   operating conditions here, not edge cases.
5. **One word per concept, in Persian.** Terminology drift between two screens
   is a defect, not a style preference.

## Accessibility & Inclusion

- **WCAG AA contrast is a verified commitment, not an aspiration.** Token
  contrast is asserted by tests (`tests/contrast.test.ts`,
  `tests/token-contrast.test.ts`), and past changes have been rejected for
  dropping a ratio below 4.5:1.
- **Wheelchair and companion seating is a first-class filter** in seat
  selection, not a note in a description field.
- Seat controls carry fully composed accessible names in Persian — section, row,
  seat, price and status in one string.
- Touch targets follow WCAG 2.2 SC 2.5.8 (24×24 minimum, larger where a thumb is
  the input); the product is used one-handed on phones.
- Every interactive element needs a visible focus ring; ARIA fills only the gaps
  native semantics cannot.
