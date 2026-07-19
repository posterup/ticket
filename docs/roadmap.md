# Roadmap

A phased plan from the current landing page to the full Event CRM. Phases are
sequenced by dependency: each builds on the system of record established by the
one before it. Scope within a phase can ship incrementally; the ordering between
phases is the load-bearing part.

Today's scope is Phase 0 (landing page and brand) plus the ticket-creation
wizard from Phase 1. Everything past that is forward-looking.

## Phase 0 - Landing and brand

**Goal:** Establish the brand and the marketing front door that explains what
Poster is to prospective organizers.

**Key features:**

- Public landing page: header, hero, feature and segment sections, footer.
- Brand foundation: Vazirmatn typography, monochrome palette (blue reserved for
  logo and semantic Info), RTL layout, light and dark themes.
- Design tokens and base component primitives (`Button`, `Badge`).

**Dependencies:** none. This is the starting point.

## Phase 1 - Ticket-creation wizard, public event page, and checkout

**Goal:** Let an organizer create an event with saleable tickets and let an
attendee buy one. This is the first end-to-end value loop.

**Key features:**

- Ticket-creation wizard at `/tickets/create` (Step 1 Event Information,
  Step 2 Schedule & Availability, Step 3 Ticket Types). The wizard is in scope
  today.
- One-time and recurring schedule handling.
- Unlimited ticket types with price, capacity, and sales windows.
- Public event page (`/e/[slug]`) rendering the published event.
- Attendee checkout that records the buyer as a contact.

**Dependencies:** Phase 0 (design system and shell). Checkout depends on at
least a basic payment path, which is hardened in Phase 5; Phase 1 can begin with
a minimal or manual payment step and a stub contact record.

## Phase 2 - Organizer dashboard and CRM

**Goal:** Give organizers a daily workspace and turn ticket buyers into a
managed audience. This establishes the attendee-as-asset system of record.

**Key features:**

- Dashboard shell and overview (`/dashboard`).
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

- SMS and email campaigns targeted by segment.
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
