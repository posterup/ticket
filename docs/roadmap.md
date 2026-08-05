# Roadmap

A phased plan to the full Event CRM. Phases are sequenced by dependency: each
builds on the system of record established by the one before it. Scope within a
phase can ship incrementally; the ordering between phases is the load-bearing
part.

**Where this stands: Phases 0–5 have all shipped in substance.** The plan is
kept because the *ordering* is still the argument for what to build next, and
because each phase's "key features" list is the checklist against which the
remaining gaps below are honest.

| Phase | State |
| --- | --- |
| 0 Landing and brand | Shipped. The landing page moved to `/hosts`; `/` is explore. |
| 1 Wizard, event page, checkout | Shipped, plus assigned seating and Zarinpal. |
| 2 Dashboard and CRM | Shipped. Contacts, tags, segments, workspaces. |
| 3 Operations | Shipped. QR tickets, `BarcodeDetector` scanning, roles. |
| 4 Marketing and analytics | Partial — SMS campaigns ship; **email does not exist**, and analytics is per-event rather than a surface of its own. |
| 5 Finance | Partial — payments, refunds, commission and the payout queue ship; **the transfer itself is a bank action taken outside the product**, recorded here rather than executed. |

Still open, and deliberately so: desktop (every viewport ≥1024px is behind
`DesktopGate`), SSE for live seat availability (polling instead — see
`docs/venue-architecture.md` §10), curved seating bowls, and per-seat nudging in
the venue designer. Everything the product does *not* do is listed with its
reason in `docs/backend-architecture.md` § Known limits and
`docs/venue-architecture.md` §14.

## Phase 0 - Landing and brand

**Goal:** Establish the brand and the marketing front door that explains what
Poster is to prospective organizers.

**Key features:**

- Public landing page: header, hero, feature and segment sections, footer.
- Brand foundation: Vazirmatn typography, the paper-and-neon palette (one hot
  pink against violet-tinted neutrals), RTL layout, light theme only.
- Design tokens, and HeroUI wired to read them.

**Dependencies:** none. This is the starting point.

## Phase 1 - Ticket-creation wizard, public event page, and checkout

**Goal:** Let an organizer create an event with saleable tickets and let an
attendee buy one. This is the first end-to-end value loop.

**Key features:**

- Ticket-creation wizard at `/tickets/create` (Step 1 Event Information,
  Step 2 Schedule & Availability, Step 3 Ticket Types).
- One-time, multi-session (سانس) and recurring schedule handling. Recurring is
  behind `NEXT_PUBLIC_CALENDAR_MODE` and hidden site-wide while off.
- Unlimited ticket types with price, capacity, and sales windows.
- Public event page (`/events/{id}`) rendering the published event.
- Attendee checkout that records the buyer as a contact.

**Dependencies:** Phase 0 (design system and shell). Checkout depends on at
least a basic payment path, which is hardened in Phase 5; Phase 1 can begin with
a minimal or manual payment step and a stub contact record.

## Phase 2 - Organizer dashboard and CRM

**Goal:** Give organizers a daily workspace and turn ticket buyers into a
managed audience. This establishes the attendee-as-asset system of record.

**Key features:**

- Dashboard shell and overview (`/dashboard/events`).
- Event and ticket management surfaces (list, edit, templates, venues).
- CRM: attendee profiles and history, contacts, custom fields, notes.
- Tags and segments for organizing the audience.
- Organization (company) management.

**Dependencies:** Phase 1 (checkout must be producing contact records for the
CRM to have data to manage).

## Phase 3 - Operations

**Goal:** Run the event on the day: control entry and coordinate staff.

**Key features:**

- QR tickets issued from purchases.
- QR check-in and gate scanning.
- Staff management, roles, and entry permissions.
- Live attendance view.

**Dependencies:** Phase 1 (tickets to encode) and Phase 2 (contact records and
the dashboard to manage staff and view attendance against).

## Phase 4 - Marketing and analytics

**Goal:** Help organizers grow the audience and understand performance.

**Key features:**

- SMS campaigns targeted by segment. **Email is not implemented** and no
  variable configures it — see the README.
- Referrals and promotional codes.
- Marketing landing pages.
- Analytics: revenue, ticket sales, attendance, conversion funnel, and
  marketing performance.

**Dependencies:** Phase 2 (segments and contacts to target and measure) and
Phase 3 (attendance data feeds the funnel and analytics).

## Phase 5 - Finance

**Goal:** Make money movement complete, correct, and transparent.

**Key features:**

- Robust online payments.
- Refunds.
- Settlement and payouts to organizers.
- Financial dashboard reconciling sales, refunds, and settlements.

**Dependencies:** Phase 1 (checkout is the source of transactions). Finance is
sequenced last so it can build on the full transaction and contact history,
though a minimal payment path is introduced earlier in Phase 1 to make checkout
functional.

## Phase summary

| Phase | Focus | Depends on |
| --- | --- | --- |
| 0 | Landing and brand | - |
| 1 | Wizard, event page, checkout | 0 |
| 2 | Dashboard and CRM | 1 |
| 3 | Operations (QR, staff, gates) | 1, 2 |
| 4 | Marketing and analytics | 2, 3 |
| 5 | Finance (payments, refunds, settlement) | 1 |
