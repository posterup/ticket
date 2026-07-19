# Product Vision: Gishe (گیشه)

> The HubSpot of Events for the Persian-speaking market.

## Mission

Give event organizers in the Persian-speaking market a single, professional
platform to run the full lifecycle of an event: plan it, sell tickets for it,
understand the people who attend it, and grow the relationship over time.

Gishe replaces the scattered toolset that organizers cobble together today
(spreadsheets, ad-hoc payment links, messaging apps, paper guest lists) with
one system of record that treats the attendee, not the ticket, as the asset.

## Positioning

**Gishe is a CRM for Events.** Ticketing is one capability inside it, not the
whole product.

- It is **not** an event marketplace.
- It is **not** a concert-discovery or entertainment site.
- It **is** business software that organizations run their events on.

The reference points are professional B2B tools: HubSpot for the CRM model,
Stripe Dashboard for financial clarity, Linear for speed and focus, Notion for
flexible structure, and Eventbrite for the ticketing surface only. The product
should feel like software a team logs into every day, not a site consumers
browse once.

### The core insight

Every ticketing tool ends the relationship at checkout. The valuable asset an
organizer builds over years is not a pile of transactions; it is the audience.
Who came, how often, what they bought, which segment they belong to, and how to
reach them again. Gishe is built around that asset. Selling a ticket is the
event that creates or enriches a contact record, and everything else (marketing,
operations, analytics, finance) hangs off the CRM.

## Target customer segments

Gishe serves organizations that run events as part of how they operate:

- Event and production companies
- Conference and summit organizers
- Universities and academic departments
- Sports clubs and federations
- Communities, meetups, and membership groups
- Workshop, seminar, and training providers
- Exhibitions and trade shows
- Government organizations and public institutions
- NGOs and nonprofits

The common thread is a repeat operator who needs to manage capacity, money,
staff, and an ongoing relationship with attendees, not a one-time seller.

## Capability map

Capabilities are grouped by area. Each item is tagged:

- **[Now]** in current scope (landing page and ticket-creation wizard).
- **[Vision]** part of the long-term product, not yet built.

### Event Management

- Create events **[Vision]** (the ticket-creation wizard captures event
  information today as its first step **[Now]**)
- Event templates **[Vision]**
- One-time, recurring, and multi-session events **[Vision]** (recurring rules
  are captured in the wizard **[Now]**)
- Venue management **[Vision]** (venue is captured as a wizard field **[Now]**)

### Ticketing

- Unlimited ticket types and categories **[Now]**
- Per-type capacity **[Now]**
- Per-type sales start and sales end windows **[Now]**
- Early-bird, VIP, student, group, and custom tiers **[Now]** (as authored
  ticket types)
- Discount codes **[Vision]**
- Dynamic pricing **[Vision]**

### CRM

- Attendee profiles and history **[Vision]**
- Notes, tags, and segments **[Vision]**
- Contacts and custom fields **[Vision]**
- Organization (company) management **[Vision]**

### Marketing

- SMS and email campaigns **[Vision]**
- Segmentation and targeting **[Vision]**
- Referrals and promotions **[Vision]**
- Landing pages **[Vision]** (the public marketing landing page exists **[Now]**)

### Operations

- QR tickets **[Vision]**
- QR check-in and gate scanning **[Vision]**
- Staff management and roles **[Vision]**
- Entry permissions **[Vision]**

### Analytics

- Revenue and ticket-sales analytics **[Vision]**
- Customer and attendance analytics **[Vision]**
- Conversion funnel **[Vision]**
- Marketing performance **[Vision]**

### Finance

- Online payments **[Vision]**
- Refunds **[Vision]**
- Settlement **[Vision]**
- Financial dashboard **[Vision]**

## Product principles

1. **The attendee is the asset.** Every feature should either build the contact
   record or act on it. Ticketing is the acquisition channel, not the goal.
2. **Professional, not playful.** Gishe is business software. Calm, spacious,
   and precise beats loud and decorative. The UI should earn a team's trust.
3. **Persian-first and RTL-native.** The product renders right-to-left with
   Persian copy and Persian numerals. RTL is the default design case, never an
   afterthought.
4. **Clarity over configuration.** Prefer sensible defaults and progressive
   disclosure. Power is available, but the common path stays short (the
   three-step wizard is the model).
5. **One system of record.** Avoid features that create data silos. Money,
   people, and events reconcile against the same source of truth.
6. **Fast and focused.** Take the cue from Linear: low latency, keyboard-
   friendly, no clutter. Respect the operator's time.
7. **Trustworthy with money and identity.** Financial and personal data must be
   handled with visible correctness. Clear numbers, honest states, no surprises.
