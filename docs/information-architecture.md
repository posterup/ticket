# Information Architecture

This document describes the surfaces of the Poster platform and their status.

## Surface overview

| Surface | Audience | Status |
| --- | --- | --- |
| Explore + public event pages | Attendees | Now |
| Checkout, incl. assigned seating | Attendees | Now |
| Attendee account (tickets, feed, orders) | Attendees | Now |
| Public marketing (`/hosts`) | Prospective organizers | Now |
| Ticket-creation wizard | Organizers | Now |
| Organizer dashboard | Organizers and staff | Now |
| Venue designer (`/admin`) | Internal staff | Now |

## Route tree

Every path below exists. Nothing here is aspirational.

```
--- Public / attendee ---

/                         Redirects to /events — the front door is explore
/events                   Explore: browse and filter public events
/events/{id}              Public event page
/events/{id}/checkout     Checkout — سانس, seat picker or ticket type + quantity
/orders/{code}            Order result, by tracking code
/feed                     Events from the workspaces you follow
/pages                    Directory of organizer pages
/w/{slug}                 One organizer's public page
/hosts                    Organizer landing page (marketing)
/me                       The buyer's home — leads with their tickets
/me/tickets               Issued tickets, QR codes, .ics download
/me/orders                Order history

/login  /signup           Phone OTP sign-in and registration

--- Organizer ---

/tickets/create           Creation wizard (3 steps), the canonical creation flow
  step 1                    Event Information
  step 2                    Schedule & Availability
  step 3                    Ticket Types

/dashboard/events         Home — my events
/dashboard/events/{id}    Manage one event: sessions, tickets, seat map,
                          collaborators, guests, registrations, refunds,
                          discounts, ticket design, link
/dashboard/customers      CRM — attendee profiles, notes, tags, segments
/dashboard/checkin        Door check-in: QR scan or typed code
/dashboard/finance        Sales, commission, refunds, bank accounts, payouts
/dashboard/marketing      SMS campaigns
/dashboard/promotions     Discount codes
/dashboard/notifications  Notifications and pending co-host invites
/dashboard/profile        Account and workspace switcher
/dashboard/profile/edit   Workspace public profile: logo, banner, name, bio
/dashboard/tickets/customize   Ticket design («قالب بلیت»)
/dashboard/settings       Organization and team
/dashboard/workspaces/new Create a workspace — asks for the name, nothing else

--- Internal staff ---

/admin                    Platform admin home
/admin/venues             Venue list
/admin/venues/{venueId}   Seat-map designer
/admin/payouts            Withdrawal queue — every organiser's IBAN, so
                          `requirePlatformAdmin()` and nothing less
```

Two notes on things that are easy to look for and not find:

- **Seat selection has no route of its own.** It renders inside
  `/events/{id}/checkout` (`components/seatmap/SeatMap.tsx`), because picking a
  seat and paying for it are one decision and a separate page would take a hold
  before the buyer had committed to anything.
- The sidebar ships four destinations plus the profile — see
  `components/dashboard/nav.ts`. The rest of `/dashboard/*` is reached from the
  event page or the profile area, not from a top-level nav.

## Public surface (Now)

The public surface has two front doors, and they speak to different people.
`/` belongs to attendees: it redirects to `/events`, so a first-time visitor
lands on explore and can find something to go to without reading a pitch.

The landing page at `/hosts` is the marketing front door for prospective
organizers, reached from the footer link on every public page. It is composed
of three structural regions:

- **Header** - brand mark (پوستر), primary navigation, and a primary call to
  action that leads organizers toward getting started.
- **Hero** - the core value proposition ("professional event management and
  ticketing for organizations") with the primary CTA and supporting motion.
- **Footer** - secondary navigation, legal links, and contact details.

The landing page sells the platform. It is not a catalog of events.

## Ticket-creation wizard (Now)

Route: `/tickets/create`. A focused, three-step flow that takes an organizer
from a blank slate to a published event with saleable tickets. The wizard is the
concrete expression of the "clarity over configuration" principle: a short,
guided path with progressive disclosure.

### Step 1 - Event Information (اطلاعات رویداد)

Captures the identity of the event.

| Field | Persian label | Notes |
| --- | --- | --- |
| Title | عنوان رویداد | Required, single line |
| Description | توضیحات | Optional, multi-line |
| Venue | محل برگزاری | Location of the event |

### Step 2 - Schedule & Availability (زمان‌بندی و برگزاری)

Captures when the event happens. Two mutually exclusive modes:

- **One-time (یک‌باره)** - a single date and time.
- **Recurring (تکرارشونده)** - a repeat rule, for example every Friday
  (هر جمعه), weekly (هفتگی), or monthly (ماهانه).

The chosen mode determines which controls are shown (single date/time picker
versus recurrence rule builder).

### Step 3 - Ticket Types (انواع بلیت)

Defines what is sold. The organizer can add an unlimited number of ticket types.
Each type has:

| Field | Persian label | Notes |
| --- | --- | --- |
| Name | نام بلیت | Required, e.g. عمومی / وی‌آی‌پی / دانشجویی |
| Price | قیمت | Amount in Toman; supports free (zero) |
| Capacity | ظرفیت | Maximum sellable count |
| Sales start | شروع فروش | When the type becomes buyable |
| Sales end | پایان فروش | When sales close |
| Description | توضیحات | Optional, per-type detail |

Example ticket types: General (عمومی), VIP (وی‌آی‌پی), Student (دانشجویی),
Early Bird (پیش‌فروش), Backstage (پشت‌صحنه).

### Wizard flow

```mermaid
flowchart TD
    Start([Start: /tickets/create]) --> S1[Step 1: Event Information<br/>title, description, venue]
    S1 --> S2{Step 2: Schedule & Availability}
    S2 -->|One-time| OneTime[Single date and time]
    S2 -->|Recurring| Recurring[Repeat rule:<br/>weekly / every Friday / monthly]
    OneTime --> S3[Step 3: Ticket Types]
    Recurring --> S3
    S3 --> AddType[Add ticket type:<br/>name, price, capacity,<br/>sales start, sales end, description]
    AddType -->|Add another| S3
    AddType -->|Done| Review[Review]
    Review -->|Back to edit| S1
    Review --> Publish([Publish event])
```

## Dashboard

The dashboard is the daily workspace where the organizer manages the audience
the wizard and checkout help them acquire. Its shape is deliberately *not* one
top-level section per capability area: most work happens against **one event**,
so event management, ticketing, seating, guests, refunds and discounts all live
inside `/dashboard/events/{id}` rather than as siblings in a sidebar. Only the
things that outlive a single event — contacts, finance, campaigns, the door —
get their own destination.

A workspace's slug is **random and permanent**. It is the address of every
organizer page and of every link an attendee was ever sent, so renaming the
workspace does not move it, and nothing in it is derived from the name — a
name-derived slug turned every Persian workspace into `workspace-2`,
`workspace-3`, publishing a count of the platform's workspaces in a URL.

## The buy box states

`lib/events/buy-state.ts` resolves the single sales state an event page shows.
Order matters: each branch answers "why can I not buy this", and the most useful
answer wins.

1. **Every سانس is off** — cancelled, «تکمیل ظرفیت» or «به زودی». Checked first,
   because "the show is not happening" beats "the tickets sold out". All
   cancelled reads «لغو شده» and mentions the refund, since that is the first
   thing a holder will wonder about; all «به زودی» offers «خبرم کن»; otherwise
   it is the waitlist when the organiser enabled one and a closed box when they
   did not.
2. Sales have not started, or there are no ticket types yet.
3. Stock exhausted or the window has closed.
4. Registration needs approval.
5. Free.
6. An early-bird ticket is on sale.
7. Otherwise: buy.

`almost-full` is deliberately bookable — it is an urgency hint an organiser sets
to sell faster, and treating it as a stop would invert it.

This used to look only at ticket types, so an event with every showing cancelled
still offered «خرید بلیت». The server refuses each of them and the checkout page
disables the buttons, so the buyer found out only after clicking through to a
page where nothing was selectable.
