# Venue Architecture — Designer & Seat Selection

Assigned seating end to end: an internal-admin venue designer that produces
reusable, versioned layout templates, and a customer seat picker that stays fast
on a 50,000-seat venue by never rendering seats it does not need.

This document is both the design and the record of what was built. Section 13
argues with the original brief; those arguments shaped the implementation.

Related: `docs/backend-architecture.md` (envelope, guards, orders),
`docs/frontend-architecture.md` (component conventions).

## Context

Poster today sells **undifferentiated inventory**: `TicketType` has a `capacity`,
`sold` and `reserved` counter, and `markOrderPaid` mints N anonymous `Ticket`
rows. There is no concept of *which* seat anyone bought. That is fine for a
standing show and useless for a theatre, cinema, or stadium.

This adds assigned seating end to end: an internal-admin venue designer that
produces reusable, versioned layout templates, and a customer seat picker that
stays fast on a 50,000-seat venue by never rendering seats it does not need.

Two decisions were settled before planning:

- **Scope:** full vertical slice — schema, APIs, customer map, admin designer
  with core tools. Arc/curved bowls, aisle authoring and per-seat nudging are
  designed but stubbed.
- **Inventory granularity:** seat availability keys on **`EventSession`**, not
  `Event`. A cinema showing one film five times needs five inventories over one
  layout. `EventSession` already exists and `Order.sessionId` already points at
  it.

Everything below fits existing conventions found in the codebase rather than
inventing parallel ones (`lib/server/http.ts` plumbing, `mappers/enums.ts`
`Record` + `invert()` pairs, conditional-`UPDATE` optimistic concurrency,
`useApi` + `AsyncState` on the client).

---

## 1. Architecture

Three planes, deliberately separated because they have different change rates
and therefore different caching:

| Plane | Changes | Delivery |
| --- | --- | --- |
| **Geometry** (layout, sections, rows, seat coordinates) | On renovation — effectively never | Immutable, version-addressed URL, cached forever |
| **Availability** (sold / held per session) | Constantly | Tiny sparse deltas, short TTL + SSE |
| **Commerce** (holds → orders → tickets) | Per transaction | Existing order flow, extended |

The customer never downloads geometry and availability in one response. This is
the single most important structural decision: it lets a 50k-seat venue's
geometry be a permanently-cached CDN artifact while availability stays a
kilobyte of indices.

```
VenueLayout (editable draft, JSONB spec)
   └── publish ──► VenueLayoutVersion (immutable spec snapshot)
                      ├── VenueSection[]  (+ compiled seat blob per section)
                      ├── VenueRow[]
                      └── VenueSeat[]     (identity for holds/orders)

EventSession ──pins──► VenueLayoutVersion
   ├── SeatStatus[]  (sparse: only SOLD/BLOCKED)
   └── SeatHold[]    (sparse: transient, TTL'd)
```

---

## 2. Database schema

New models in `prisma/schema.prisma`. Enum members stay SCREAMING_CASE with
`@map` to hyphenated wire values, matching the twelve existing pairs.

```prisma
model VenueLayout {                 // editable head, one per Venue
  id        String  @id @default(uuid())
  venueId   String  @unique
  name      String
  /// LayoutSpec — read and written whole by the designer, never queried into.
  draft     Json
  publishedVersionId String?
  venue     Venue   @relation(fields: [venueId], references: [id])
  versions  VenueLayoutVersion[]
}

model VenueLayoutVersion {          // immutable snapshot
  id         String @id @default(uuid())
  layoutId   String
  version    Int
  spec       Json                   // frozen LayoutSpec
  width      Float
  height     Float
  totalSeats Int
  publishedAt DateTime @default(now())
  sections   VenueSection[]
  sessions   EventSession[]
  @@unique([layoutId, version])
}

model VenueSection {
  id         String      @id @default(uuid())
  versionId  String
  key        String                 // stable slug, e.g. "vip"
  name       String
  kind       SectionKind            // SEATED | STANDING
  /// SectionShape — rect | polygon | arc.
  shape      Json
  color      String
  labelX     Float
  labelY     Float
  /// Authored proximity tier (1 = closest). Not computed distance — see §13.
  tier       Int
  capacity   Int                    // authoritative for STANDING
  seatCount  Int
  /// Columnar seat geometry, compiled at publish. Never join VenueSeat to draw.
  seatBlob   Json?
  displayOrder Int
  rows       VenueRow[]
  seats      VenueSeat[]
  @@unique([versionId, key])
}

model VenueRow {
  id        String @id @default(uuid())
  sectionId String
  key       String
  label     String
  index     Int
  seatCount Int
  seats     VenueSeat[]
  @@unique([sectionId, key])
}

model VenueSeat {
  id        String   @id @default(uuid())
  sectionId String
  rowId     String
  /// Section-local ordinal. This is the wire identity — never send uuids.
  index     Int
  label     String                  // ASCII; Persian digits are a render concern
  x         Float
  y         Float
  kind      SeatKind @default(STANDARD)
  @@unique([sectionId, index])
  @@index([rowId])
}

model SeatStatus {                  // SPARSE — absence means available
  id        String     @id @default(uuid())
  sessionId String
  seatId    String
  state     SeatState              // SOLD | BLOCKED
  orderId   String?
  @@unique([sessionId, seatId])
  @@index([sessionId])
}

model SeatHold {                    // SPARSE, transient
  id        String   @id @default(uuid())
  sessionId String
  seatId    String
  /// Browser-session token or userId — who may release/convert this hold.
  holderKey String
  orderId   String?
  expiresAt DateTime
  @@unique([sessionId, seatId])     // the atomicity primitive
  @@index([expiresAt])
  @@index([sessionId, holderKey])
}

model SessionSectionPricing {       // section → TicketType, per event
  id           String @id @default(uuid())
  eventId      String
  sectionId    String
  ticketTypeId String
  @@unique([eventId, sectionId])
}

enum SectionKind { SEATED @map("seated")  STANDING @map("standing") }
enum SeatState   { SOLD @map("sold")  BLOCKED @map("blocked") }
enum SeatKind {
  STANDARD   @map("standard")
  WHEELCHAIR @map("wheelchair")
  COMPANION  @map("companion")
  OBSTRUCTED @map("obstructed")
  HOUSE      @map("house")
}
```

Also: `EventSession.layoutVersionId String?`, and `Ticket.seatId String?` so an
issued ticket names its seat.

**Why sparse status.** Materialising a row per seat per session is 50k rows ×
every showing. Absence-means-available keeps the table proportional to *sales*,
not to capacity. A 50k-seat venue at 10% sold costs 5k rows.

**Why `VenueSeat` rows exist at all** despite `seatBlob` carrying geometry:
holds, order lines, and issued tickets need referential integrity and reporting
joins. Reads for *drawing* never touch this table.

---

## 3. Layout spec (the designer's document format)

One JSONB document, the source of truth the designer edits and publishing
compiles. Sections declare a **row generator** rather than enumerated seats, so
a 50k-seat stadium is a few kilobytes of spec.

```jsonc
{
  "version": 1,
  "bounds": { "width": 1200, "height": 900 },
  "stage": { "shape": { "type": "rect", "x": 400, "y": 40, "w": 400, "h": 70 },
             "label": "صحنه" },
  "sections": [{
    "key": "vip", "name": "VIP", "kind": "seated",
    "shape": { "type": "polygon", "points": [[300,200],[900,200],[860,320],[340,320]] },
    "color": "accent", "tier": 1, "labelAt": [600, 260],
    "rows": {
      "count": 8, "spacing": 34, "seatSpacing": 28,
      "origin": [340, 215], "angle": 0, "curve": 0,
      "seatsPerRow": [22, 22, 24, 24, 26, 26, 28, 28],
      "numbering": {
        "rowScheme": "latin",        // latin | numeric | persian-alpha | custom
        "rowDirection": "front-to-back",
        "seatScheme": "sequential",  // sequential | odd-even | block
        "seatStart": 1,
        "seatOrigin": "right",       // RTL venues differ — authored, never inferred
        "skip": [13]
      }
    },
    "overrides": { "12": { "kind": "wheelchair" } }   // sparse, by seat index
  }]
}
```

`overrides` is the escape hatch that keeps the generator usable for real venues
without forcing full enumeration.

---

## 4. APIs

Split strictly along the geometry/availability seam.

**Immutable — `Cache-Control: public, max-age=31536000, immutable`** (safe
because the URL contains the version id):

| Endpoint | Returns |
| --- | --- |
| `GET /api/layouts/{versionId}/overview` | bounds, stage, sections (shape, name, colour, tier, capacity). No seats. ~4–15 KB. |
| `GET /api/layouts/{versionId}/sections/{key}/seats` | Columnar seat geometry for one section. |

Columnar, because `[{x,y,label},…]` × 5000 is mostly repeated JSON keys:

```jsonc
{ "key": "vip", "count": 240,
  "rows":  [{ "key": "A", "label": "A", "from": 0, "count": 24 }],
  "x":     [340, 368, 396, …],
  "y":     [215, 215, 215, …],
  "label": ["1","2","3", …],
  "kind":  [0,0,1,0, …] }
```

**Volatile — short TTL, never cached at the edge:**

| Endpoint | Returns |
| --- | --- |
| `GET /api/sessions/{id}/availability` | Per-section `{ available, priceFrom, indicator }`. Seconds of TTL. |
| `GET /api/sessions/{id}/sections/{key}/status` | `{ "sold": [3,7,19], "held": [22,23] }` — section-local indices. |
| `GET /api/sessions/{id}/stream` | SSE deltas for the open section. **Designed, not implemented** — see §14. |

**Commerce:**

| Endpoint | Behaviour |
| --- | --- |
| `POST /api/sessions/{id}/holds` | `{ section, seats: [idx] }` → acquires or 409 `SEAT_TAKEN`. |
| `POST /api/sessions/{id}/best-available` | `{ quantity, section?, maxPrice?, accessible? }` → picks *and holds*. §16. |
| `DELETE /api/sessions/{id}/holds` | Release the caller's holds. |
| `POST /api/orders` | Extended: accepts `seats`, converts holds to order lines. |

**Admin (all behind a new `requirePlatformAdmin()`):**
`GET/POST /api/admin/venues`, `GET/PATCH /api/admin/venues/{id}/layout` (save
draft), `POST /api/admin/venues/{id}/layout/publish` (compile a version).

New `ErrorCode` members: `SEAT_TAKEN`, `HOLD_EXPIRED`, `HOLD_LIMIT`.

---

## 5. Reservation locking

Reuses the codebase's existing idiom exactly — a conditional write whose
affected-row count is the verdict (as `reserve()` does in `lib/server/orders.ts`)
— rather than introducing Redis or advisory locks.

```sql
INSERT INTO "SeatHold" ("id","sessionId","seatId","holderKey","expiresAt")
SELECT $1, $2, $3, $4, $5
 WHERE NOT EXISTS (SELECT 1 FROM "SeatStatus"
                    WHERE "sessionId" = $2 AND "seatId" = $3)
    ON CONFLICT ("sessionId","seatId") DO UPDATE
       SET "holderKey" = EXCLUDED."holderKey",
           "expiresAt" = EXCLUDED."expiresAt"
     WHERE "SeatHold"."expiresAt" < now()
```

One statement: refuses sold seats, takes the hold if free, and steals it if the
existing hold has lapsed. `affected === 1` means acquired. Expired rows are also
swept lazily at the top of the hold call, mirroring how `releaseExpiredOrders`
is invoked from `createOrder` (serverless has no cron).

**Hold TTL must exceed order TTL.** `HOLD_MINUTES` is 15; seat holds get 20 and
are *transferred* to the order on `createOrder` (`SeatHold.orderId` set) rather
than left to lapse — otherwise a buyer at the payment gateway loses their seats
mid-transaction. On settlement the hold is deleted and a `SeatStatus(SOLD)` row
plus `Ticket.seatId` are written inside the existing `markOrderPaid`
transaction.

**Abuse cap:** holds are free denial-of-inventory. Cap at 10 seats per session
and rate-limit acquisition per `holderKey`.

---

## 6. Rendering engine

| | SVG | Canvas 2D | WebGL |
| --- | --- | --- | --- |
| Nodes for 5k seats | 5k DOM — unusable | 1 element | 1 element |
| Accessible for free | Yes | No | No |
| Text quality | Native | Good | Painful |
| Throughput ceiling | ~1k shapes | ~50k shapes | Millions |
| Complexity | Lowest | Moderate | High |

**Overview → SVG.** Tens of sections. Each becomes a real `<button>` with an
`aria-label`, so keyboard and screen-reader support is free, text is crisp, and
colours come from the existing CSS tokens.

**Section → Canvas 2D.** Only one section renders at a time, and a section is
typically ≤5,000 seats. Batch seats into one `Path2D` per state and issue ~4
`fill()` calls per frame; hit-test through a uniform spatial grid, never a
linear scan. DPR-aware backing store, redraw only on transform change.

**WebGL is not justified here** and is deliberately not built. It earns its
complexity above ~20–30k *simultaneously visible* seats, which the
one-section-at-a-time model never produces. Documented as an escape hatch
(instanced quads) if a single-section stadium tier ever exceeds that.

Never a DOM node per seat.

---

## 7. Progressive rendering

1. **Overview.** Fetch immutable geometry (cached forever) + availability
   summary. Render SVG blocks with name, price-from, availability indicator.
2. **Drill in.** Tap a section → fetch its seat artifact + status → a canvas
   overlays that section in place; other sections stay as dimmed SVG. The
   overview never unmounts, so spatial context survives.
3. **Switch.** Only one section is *rendered*, but the last 3 decoded sections
   stay in an LRU **data** cache, so going back is instant with no refetch.
4. **Adaptive.** If the venue totals ≤ ~600 seats, skip step 1's modality and
   render seats immediately — see §13.

Prefetch a section's artifact on hover/focus intent (desktop) and on
pointerdown (touch), which hides most of the latency.

---

## 8. Seat numbering

A pure, deterministic generator — `lib/venues/numbering.ts`, unit-tested with no
database, matching how the discount helpers are tested. (`resolveBuyState` was
cited here too and was *not* tested — it lived inside a Server Component. It is
now `lib/events/buy-state.ts`, with tests.)

```
generateRow(rowIndex, spec) → { label, seats: [{ index, label, x, y }] }
```

Parameters: `rowScheme` (latin A→Z→AA, numeric, Persian alpha الف/ب/پ, custom
list), `rowDirection`, `seatScheme` (`sequential`, `odd-even` for European
centre-aisle halls, `block` restarting per aisle), `seatStart`, `seatOrigin`
(**left|right — authored, since RTL venues genuinely differ**), and a `skip`
list for numbers omitted by convention (13, 4). Positions interpolate along the
row's line or arc; equal arc-length distribution for curved rows.

Labels are stored ASCII and rendered with the existing `formatNumber()` from
`lib/format.ts`, so sorting and door-scanning stay sane while the UI reads
Persian.

---

## 9. Admin designer

Routes `/admin/venues` and `/admin/venues/[id]`, gated by a new
`requirePlatformAdmin()` in `lib/server/auth/guards.ts` that reads the existing
`User.platformAdmin` column (already loaded into `SessionUser`, currently
unused by any guard). `/admin` is added to `middleware.ts`'s `PROTECTED` list.

The canvas editor is loaded with `next/dynamic({ ssr: false })`, the pattern
`LocationPicker.tsx` already uses for Leaflet.

- **Canvas:** pan/zoom, snap-to-grid, marquee select, transform handles.
- **Tools:** select, rectangle section, polygon section (click vertices, Enter
  closes), stage placement. Shortcuts `V`/`R`/`P`.
- **Transforms:** move, resize, rotate, duplicate, mirror horizontal/vertical.
- **Inspector:** name, kind, colour, tier, and the row-generator + numbering
  config, with a live seat preview.
- **State:** one `LayoutSpec` in a reducer, with a capped command-pattern
  undo/redo stack.
- **Save** writes `VenueLayout.draft`; **Publish** compiles a
  `VenueLayoutVersion`, materialises rows/seats, and writes the columnar blobs.

Stubbed with clear TODOs: true arc/curved bowls, aisle and exit authoring,
per-seat nudging.

---

## 10. Real-time

SSE at `GET /api/sessions/{id}/stream`, emitting deltas only for the section the
customer has open. Overview counts poll on a short interval — they are advisory
and do not warrant a socket. Fan-out via Postgres `LISTEN/NOTIFY`.

**Honest limit:** one SSE connection per viewer does not survive a 50k-concurrent
on-sale on plain serverless. Documented with a managed-pubsub path
(Redis/Ably) as the scale-out, rather than pretending the first implementation
is stadium-grade.

---

## 11. Files

**Schema/data:** `prisma/schema.prisma`, one migration, `prisma/seed-data.ts`
(a ~400-seat theatre and a ~12k-seat arena; new ids appended — existing seed ids
are load-bearing and must not be renumbered).

**Server:** `lib/server/venues/{layouts,compile,overview,seats,holds}.ts`,
`lib/server/auth/guards.ts` (+`requirePlatformAdmin`),
`lib/server/schemas/venue.ts`, `lib/server/mappers/enums.ts` (+3 enum pairs),
`lib/server/orders.ts` (seat-aware `createOrder`/`markOrderPaid`),
`lib/server/http.ts` (+3 error codes).

**Pure logic (unit-tested, no DB):** `lib/venues/{spec,numbering,geometry}.ts`.

**API:** `app/api/layouts/**`, `app/api/sessions/[id]/**`, `app/api/admin/venues/**`.

**Customer UI:** `components/seatmap/{VenueOverview,SectionCanvas,SeatLegend,
SeatList,useSeatmap}.tsx`, wired into `components/checkout/CheckoutForm.tsx`
(which already sends an `items[]` array, so seats extend it rather than replace
it).

**Admin UI:** `app/admin/**`, `components/admin/designer/*`.

**Docs:** `docs/venue-architecture.md` (the full design + the critique below),
plus updates to `docs/backend-architecture.md` and `CLAUDE.md`.

---

## 12. Verification (as run)

- `npx tsc --noEmit`, `npm run lint`, `npm test` (307 currently green).
- New unit suites for the numbering generator and spec compiler — pure, so they
  run without a database like `tests/create.test.ts` does.
- New `tests/api/seatmap.test.ts` using the existing `describeApi`/`req`/`ctx`
  helpers, covering: overview shape, section artifact, **concurrent hold on the
  same seat where exactly one caller wins**, hold expiry/steal, hold→order
  conversion, and sold-seat rejection.
- `docker compose up --build` + `docker compose run --rm seed`, then walk the
  seeded arena: overview → drill into a section → select seats → checkout.
- Measure and record: overview payload size, section artifact size, and
  time-to-interactive for the 12k-seat fixture.

---

## 13. Challenging the brief

The design above follows the request, except where it does not. These are the
points worth arguing before any code is written.

**1. "The overview must never render individual seats" is too absolute.**
For a 120-seat black-box theatre or a 200-seat cinema, a mandatory drill-in adds
a tap and destroys context for zero performance gain. Ticketmaster and AXS
render small-venue maps directly. *Recommendation: adaptive threshold (~600
seats).* The rule should be "never render seats you cannot afford to", not
"never render seats".

**2. "Only one section interactive at a time" conflates rendering with data.**
Rendering one section is right. *Unloading* the previous section's data is not —
a customer comparing VIP against Balcony refetches on every toggle, which is the
exact thrash the design is trying to avoid. Keep one canvas; cache three decoded
section payloads.

**3. The biggest omission: there is no "best available".**
Most customers do not want to pick seats. They want two decent seats together at
a price. Every major platform leads with quantity + best-available and treats
the map as *refinement*. A pure drill-in flow buries the highest-converting path
in the funnel. *Recommendation: quantity picker first, "best available" as a
primary CTA beside the map.* This is my strongest disagreement with the brief.

**Resolved** — `lib/server/venues/best-available.ts`, §16.

**4. Accessibility is missing and is a legal exposure.**
A canvas seat map is invisible to assistive technology, and ticketing is
specifically targeted under ADA/EN 301 549. A parallel DOM listbox ("ردیف A،
صندلی ۱۲، ۴۵۰٬۰۰۰ تومان، آزاد"), keyboard navigation, and real
wheelchair/companion seat types with a filter are requirements, not polish.
`SeatKind` and `SeatList` above exist for this reason.

**5. Per-section available counts are stale by definition.**
Under any real on-sale, "۱۷۸ صندلی آزاد" is wrong the moment it paints. Show a
bucketed indicator rather than a precise number, and never let the count gate
selection — the hold is the only authority.

**6. "Approximate distance from the stage" is the wrong metric.**
Euclidean distance ranks a front-side seat above a centre balcony seat, which is
acoustically and visually backwards. Distance is also meaningless for
theatre-in-the-round. *Recommendation: authored tiers set by the ops team*
(hence `tier`, not `distance`).

**7. Standing/GA sections break the Venue→Section→Row→Seat hierarchy.**
The brief asks for standing areas and outdoor festivals, which have capacity but
no seats. Modelled as `kind: standing` with capacity only, rendering as a block
with a quantity stepper. Worth stating explicitly because the four-level
hierarchy as written cannot express it.

**8. Venue versioning is absent from the brief and is essential.**
"Every venue is designed once" is not true over time — venues get renovated and
re-striped. Without pinning a version, editing a template silently rewrites the
seat locations printed on already-sold tickets. Hence
`EventSession.layoutVersionId`.

**9. Holds must survive the payment redirect.** A 10-minute hold plus a slow
gateway round-trip resells a paying customer's seat. Hold TTL exceeds order TTL
and holds transfer to the order.

**10. Seat maps answer "which is free", not "which is good".**
A price/quality heat toggle is cheap and is what customers actually ask. Worth a
fast follow.

**11. Holds are an inventory-denial weapon.** Without per-session caps and rate
limits, a trivial bot holds every seat in the house. Build the cap on day one.

**Half-built, then finished** — see §19. The per-holder cap shipped; the rate
limit did not, and the per-holder cap alone caps nothing.

**12. RTL seat origin cannot be inferred.** Which side holds seat 1 varies by
venue even within Iran. It is an authored field, not a convention.

---

## 14. Implementation status

### Measured

Taken from the seeded fixtures against the dev server. Sizes are uncompressed
JSON; the dev server does not gzip, so production figures will be smaller.

| Payload | Bytes |
| --- | --- |
| Arena overview — 6 sections, 9,080 capacity | **1,377** |
| Theatre overview — 4 sections, 468 seats | **989** |
| One stand's seat artifact — 1,496 seats | 28,527 |
| Session availability — 6 sections, all priced | 892 |
| Section status, nothing sold | **91** |
| Section status, with two house seats blocked | 95 |

Two of these grew since first measured, both for reasons worth keeping: the
availability payload once covered a session with only some sections priced, and
the status payload gained a third array when house seats became distinguishable
from sold ones. Neither is close to mattering — status is under a hundred bytes
either way, which is what makes it cheap enough to poll.

The headline is the first row: orienting a customer inside a 9,080-capacity
stadium costs 1.4 KB, because the overview carries no seats. Seat geometry only
arrives for the one section they open, and it is `immutable`-cached, so
re-opening it later costs nothing.

### Built

Assigned seating runs end to end: hold → order → payment → issued ticket naming
its seat → seat marked sold. Release paths (expiry, cancel, gateway failure)
return seats to sale immediately rather than waiting out the hold TTL.


- `types/venue-layout.ts`, `lib/venues/{spec,numbering,geometry}.ts` — the
  layout format and the deterministic seat generator. Pure; 21 unit tests run
  with no database.
- Schema: `VenueLayout`, `VenueLayoutVersion`, `VenueSection`, `VenueRow`,
  `VenueSeat`, `SeatStatus`, `SeatHold`, `SessionSectionPricing`, plus
  `EventSession.layoutVersionId` and `Ticket.seatId`. Migration
  `20260729162730_venue_seat_maps`.
- `lib/server/venues/{layouts,seatmap,holds,holder}.ts` — publish/compile, the
  split read path, and the atomic hold.
- Endpoints: layout overview and section seats (immutable), session
  availability and section status (volatile), seat holds (GET/POST/DELETE),
  session detail, and three admin routes behind `requirePlatformAdmin()`.
- Customer UI: `components/seatmap/*` — SVG overview, Canvas 2D section
  renderer, accessible `SeatList`, LRU section cache, prefetch on intent.
  It has **no route of its own**: `SeatMap` renders inside
  `/events/{id}/checkout`, because picking a seat and paying for it are one
  decision and a separate page would take a hold before the buyer had committed
  to anything.
- Admin UI: `/admin/venues` and the designer at `/admin/venues/{venueId}` —
  add/select/move sections, rotate, scale, mirror, duplicate, delete, full
  row-generator and numbering inspector, undo/redo, save draft, publish.
- Fixtures: a 468-seat theatre and a 6,080-seat arena with a standing terrace.

### Not built, deliberately

These are designed above but stubbed, and none of them are load-bearing for the
flow that works today:

- **Arc/curved seating bowls.** `ArcShape` is authored, stored and rendered, but
  `generateSection` lays straight rows inside it rather than following the arc.
- **Aisle and exit authoring.** No first-class objects yet; an aisle is
  currently expressed as a gap between two sections.
- **Per-seat nudging in the designer.** The `overrides` map supports it and the
  compiler honours it, and the seeded theatre uses it for wheelchair, companion,
  obstructed and house seats — but there is no drag-a-single-seat UI.
- **SSE.** Availability and section status poll (15 s / 8 s) with a visibility
  check. The stream endpoint in §4 is not implemented; see §10 for why one
  connection per viewer is the wrong first move.

---

## 15. Checkout integration

The seam turned out to be smaller than expected, because `CreateOrderInput`
already carried an array of line items.

**The client names seats and nothing else.** `createOrder` accepts
`seats: [{ section, seats: [index] }]` and derives the ticket type and price
from `SessionSectionPricing`. A request that also sent a price would be
describing what it would *like* to pay, so it does not get to.

**Holds transfer rather than re-race.** The customer won the race when they
picked the seat; making them win it again at submit is how you take a seat back
from someone halfway through paying. `attachHoldsToOrder` stamps `orderId`, and
from then on the sweeper leaves the hold alone — which is what lets the seats
survive the trip to the payment gateway.

**Settlement** issues one ticket per seat carrying `seatId`, writes a sparse
`SeatStatus(SOLD)` row, and deletes the hold in a single transaction.

**A visible clock.** The hold deadline was always in the response and the client
threw it away, so the first a customer knew of expiry was a failed submit. The
seat map now counts down, turns urgent under two minutes, and clears the
selection on expiry rather than leaving seats lit that are no longer theirs.

### Two gates that were decorative

Both were dashboard settings the buying flow ignored:

- **Approval-required** events linked straight to checkout, creating a paid
  order and skipping the host's decision. Now the page offers a join request,
  and `createOrder` refuses an order without an *accepted* registration matching
  the buyer's phone — enforced server-side, because client routing alone is one
  crafted POST away from being bypassed.
- **Waitlist** was a notify subscription wearing a waitlist label. It is now a
  real queue with derived positions, notified in arrival order whenever
  inventory is released.

## 16. Best available

The default path, and the one most buyers should take. §13.3 argued that a
drill-in-only flow buries the highest-converting route in the funnel; this is
that argument implemented.

`POST /api/sessions/{id}/best-available` takes a quantity and optionally a
per-seat budget, a section, and an accessibility flag. It answers with seats it
has **already held** — not a recommendation. A suggestion the client then has to
go and claim reintroduces exactly the race the hold exists to settle: by the
time the buyer taps it, the seats can be gone. Picking and taking in one call
also lets the server fall through to the next candidate when it loses a race,
which a client round-trip cannot do without flickering.

### What "best" means

Across sections, the ops team's authored `tier` decides, ascending. No formula
knows that a centre balcony beats a front-side stall (§13.6), so none is used.

Within a section, each contiguous run of the requested length is scored:

```
score = 0.6 × off-centre  +  0.4 × row-depth
      + 1.0   if any seat has a restricted view
      + 0.15  if taking the run would strand a lone seat
```

Both terms are normalised to 0–1. Centrality leads because being off to the side
of a hall is felt more sharply than being a few rows back — the end of row 3
looks at the stage sideways; the centre of row 8 does not — but not so far that
the back wall outranks the front.

The 0.15 term is the cheap version of what the industry calls a **seat gap
rule**. A single seat orphaned between a sold block and a fresh booking is close
to unsellable. It is a penalty rather than a prohibition, so a nearly-full house
can still sell its last singles.

### What it will not hand out

- **Accessible spaces.** Wheelchair and companion seats are excluded by default
  and *required* when `accessible: true`. They are the one kind of seat that
  cannot be substituted, and spending them on someone who did not ask takes them
  from a buyer who has no alternative.
- **House seats.** Never sellable, in any mode.
- **Unpriced sections**, and **sections whose ticket type is outside its sales
  window.** Both would produce a twenty-minute hold that `createOrder` then
  refuses — `CONFLICT` and `SALES_CLOSED` respectively. When the buyer picks a
  section themselves they at least chose it; when the server picks, it has to
  pick something buyable.

### Cost

One section is loaded at a time, stopping at the first that yields a run, so a
12,000-seat arena reads only the tier the buyer actually gets. Adjacency is
consecutive `index` within a row — deliberately not proximity in `x`, because
two seats either side of an aisle are close together and are not "together".
Until aisles are authored (§14) index adjacency is the only honest signal.

## 17. Selection spans sections

The picker held one flat `Set<number>` of seat indices while `sectionKey` moved
independently. Those two pieces of state could disagree, and opening a second
section made them:

- the summary printed the **new** section's name against the **old** section's
  seats, so «بالکن: ردیف A صندلی ۱۲» described a seat in the stalls;
- `held` subtracts the current selection so a buyer's own seats do not render as
  taken — with stale indices that unmasked *another customer's* held seat
  wherever the numbering happened to collide;
- the original holds stayed on the server, invisible and unbuyable, still
  counting against the ten-seat cap;
- and the order that was finally submitted named seats the buyer had never
  held, so checkout failed with `HOLD_EXPIRED` for no reason they could see.

Selection is now `Record<sectionKey, SeatDetail[]>` — keyed by section, and
carrying resolved labels rather than bare indices, because a label can only be
read while that section's geometry is loaded.

Three things fall out of it:

**Switching sections is just a change of view.** Nothing to clear, nothing left
behind, and going back shows what was already picked.

**A basket may span sections.** `priceSeatSelection` and `POST /api/orders` have
always accepted `selections: [{section, seats}]`; nothing could produce the
request. Two seats in the stalls and two in the balcony is now one order, priced
per section rather than by multiplying the open section's price by the whole
selection.

**A reload restores everything.** `GET /holds` returns one group per section and
the client used to keep only the first, discarding real holds the buyer could
neither see nor release. All groups are restored; labels start empty and are
filled in as each section loads, with the summary falling back to a count rather
than rendering «ردیف  صندلی ».

### Separate clocks

`holdSeats` stamps `now + SEAT_HOLD_MINUTES` at the moment of *each*
acquisition, so seats taken ten minutes apart lapse ten minutes apart. Verified
against a running server: two acquisitions three seconds apart come back with
deadlines three seconds apart.

The picker kept one `holdExpiresAt` and each response overwrote it, so the
countdown showed the **newest** deadline. A buyer picking two seats in the
stalls, browsing, then adding two in the balcony saw the timer reset to twenty
minutes while the stalls seats had ten left — and then lost them with the clock
still reading «۰۹:۵۸».

Deadlines are now keyed by section alongside the picks, and the countdown shows
the **earliest** one that still has seats behind it. That is the moment the
buyer starts losing something, and a timer that reassures them until their
booking silently shrinks is worse than no timer.

When it fires, only the sections that actually lapsed are dropped — clearing the
whole selection would throw away seats that are still held, since the countdown
tracks the earliest of several deadlines and usually not the only one. Losing
some seats and losing all of them say different things, so they read
differently.

The arithmetic lives in `lib/venues/selection.ts` — pure, and unit-tested
without a DOM, including the case where a deadline is left behind by seats that
were already released (a stale entry would end the countdown early).

## 18. Two ceilings on a section

`getAvailability` reported `section.capacity − (sold + held seats)`. For a
seated section the sparse seat rows make that exact. For a **standing** section
there are no seat rows at all, so the subtrahend was always zero: a
3,000-capacity floor advertised 3,000 places forever, however many tickets had
been sold.

The seated sections were wrong too, just less visibly. Every line — seated or
standing — is reserved against its `TicketType` in `createOrder`, so the
allocation the organiser put on sale is as real a bound as the room, and is
often the smaller one. In the seeded arena, four stands and the standing floor
all map to one 200-ticket allocation with 60 sold: the honest number is 140, and
the map was advertising 1,496 per stand and 3,000 on the floor.

Nothing was ever oversold — `reserve()` is a conditional write and refuses past
capacity. The damage was to the buyer, who picked seats, filled in the form, and
met `SOLD_OUT` at submit.

```
physical  = section.capacity − sold − held        // exact for seated, useless for standing
allocated = ticketType.capacity − sold − reserved // what createOrder will actually grant
available = min(physical, allocated)
```

Both directions matter: `vip-box` is a 96-seat box against a 140-ticket
remainder and correctly reports 96.

Sections sharing a ticket type are each capped by the same remainder rather than
given a slice of it. "You could buy up to 140 here" is true of every one of
them; any split would be a guess about who buys first.

The indicator is graded against the ceiling that produced the number. Grading
140-remaining against a 3,000-capacity room yields a 4.7% ratio and reads
«almost-full» for a floor with 70% of its allocation intact.

### Holding against the allocation

Fixing the *reported* number left the hole one step further in: `holdSeats`
consulted `SeatStatus` and `SeatHold` and nothing else, so a buyer could take
seats in a section whose `TicketType` was completely spent. Verified by setting
an allocation to zero remaining and holding two untouched seats — accepted.

Two harms, and the second is worse. The buyer is refused at submit, after
filling in a form. And for twenty minutes those seats are unavailable to
everyone else, held for a sale that can never complete — inventory denial by
accident rather than by attack.

`holdSeats` and `findBestAvailable` now both check what the allocation will
still grant. **Live holds are subtracted as well as `reserved`**: holds never
touch that counter, so without it ten shoppers could each hold the last ten
seats of a ten-ticket allocation and nine would discover the problem only at
checkout. Sections sharing a ticket type draw on one pool, so a sibling's holds
count too.

An unpriced section is deliberately unlimited here — `priceSeatSelection`
refuses it at checkout with a clearer error, and inventing a limit would mask
that.

## 19. The cap that was not a cap

`MAX_SEATS_PER_HOLDER` is ten, and on its own it bounds nothing at all. A
guest's `holderKey` is a cookie *the guest controls* — `resolveHolderKey` mints
it and sets it on their browser — so a script that clears the cookie is a new
holder with a fresh allowance. Ten seats, clear, ten more, until it is holding
everything on sale. §13.11 predicted exactly this and only the easy half was
built.

`SeatHold.ip` and `MAX_SEATS_PER_IP` (three times the per-holder allowance) are
the other half: the address is the thing a cleared cookie cannot change. Three
times, because a household, an office and a mobile network all share an address
and several people may genuinely be buying at once — the cost of getting this
wrong is refusing real customers during the on-sale it exists to protect.

Applied in **both** places that take a seat. `findBestAvailable` claims seats
directly rather than going through `holdSeats`, so without its own check it
would simply be the way round the ceiling.

Honest about what it is:

- **A ceiling on damage, not a bot detector.** It bounds one machine to thirty
  seats instead of the house. A distributed script is unaffected, and stopping
  that needs a queue and real bot detection.
- **Never authentication.** `x-forwarded-for` is spoofable by anyone talking to
  the origin directly. It is used here exactly as the OTP flow has always used
  it — a blunt instrument for rate limiting, and nothing else.
- **A ceiling on *live* holds.** As holds lapse the allowance returns, so it is
  not a ban on an address.
- **Absent when the address is.** Behind a proxy that strips the header the
  per-holder cap still applies and there is simply no second ceiling.

## 20. The same rules at every door

Three bugs in a row were one shape: a constraint enforced on one path into seat
inventory and not the other. The allocation ceiling went into `holdSeats` and
`findBestAvailable` separately. The per-address cap needed adding twice. The
sales window was in `createOrder` and `findBestAvailable` but **not**
`holdSeats` — verified on the running server, which happily held seats in a tier
whose sales opened in a week, to refuse them at submit twenty minutes later.

Each was found by reading the code. That does not scale, and it is luck.

`tests/api/seat-guards-matrix.test.ts` stops testing constraints and starts
testing *coverage*: every rule against every door, generated as a matrix. Adding
an entry point that forgets a rule, or a rule applied to only half the doors,
fails there.

| | `holdSeats` | `findBestAvailable` | `createOrder` |
| --- | --- | --- | --- |
| cancelled سانس | ✓ | ✓ | ✓ |
| «تکمیل ظرفیت» | ✓ | ✓ | ✓ |
| «به زودی» | ✓ | ✓ | ✓ |
| sales not open | ✓ | ✓ | ✓ |
| sales closed | ✓ | ✓ | ✓ |
| allocation spent | ✓ | ✓ | ✓ |
| per-address ceiling | ✓ | ✓ | — |

Each door also has a positive case, because a matrix of refusals proves nothing
if the door is simply shut.

Writing it caught its own bug immediately: `findBestAvailable` takes
`sectionKey`, and the route maps `body.section` onto it. Passing `section`
silently un-pins the search, so it falls through to a healthy tier and three
rules "passed" without being exercised at all.

## 21. The whole journey, once, over HTTP

Every test so far exercises a piece in-process. This drives the sequence a real
buyer follows, against a running server, and it is the only check that the parts
compose. Run against the seeded theatre:

| step | result |
| --- | --- |
| 1. discovery lists the event | 14 public events, ours among them |
| 2. event payload | title, venue, `status=published` |
| 3. availability | vip 36, stalls 234, side-left 54 — capped by allocation |
| 4. best-available picks **and holds** | «ویژه» ردیف A صندلی ۷،۶ @ ۵٬۵۰۰٬۰۰۰ |
| 5. reload restores the hold | `vip: [5, 6]` with its deadline |
| 6. order those exact seats | `H332R6ER`, ۱۱٬۰۰۰٬۰۰۰, pending-payment |
| 7. payment opens | gateway redirect with the order and authority |
| 8. settlement | PAID, 2 tickets, each naming its seat |
| 9. a second buyer tries seat 5 | `SEAT_TAKEN` |
| 10. order page by code | 2 tickets, `buyerPhone` withheld |
| 11. the ticket | seat, `startAt` **and** `endAt` — the calendar needs both |
| 12. first scan | admitted |
| 13. second scan | refused, «قبلاً ثبت ورود شده است» |
| 14. refund | 2 tickets voided, 2 seats released |
| 15. scan after refund | refused, «این بلیت باطل شده است» |

Nothing failed, and the database returned to zero orders, tickets, holds and
seat-status rows afterwards.

Worth stating plainly because most of this document records defects: the pieces
that were fixed one at a time — the allocation ceiling, the availability
figures, the hold restoration, the cancellation flag, the refund unwind, the
door's duplicate refusal — hold together as a sequence, not only in isolation.

This is deliberately **not** a test. It duplicates coverage that already exists
per-piece, and a fifteen-step integration test against a live server is the kind
that fails for reasons unrelated to the code. Its value was in running it once,
after the parts were built separately.

## 22. What the hold path costs, and whether it still holds

Several rounds of guards were added to `holdSeats` — the allocation ceiling,
live-hold subtraction, the per-address cap, the sales window. Each is another
query on the hottest path in the product, and each is a chance to have broken
the concurrency primitive underneath. Measured rather than assumed:

**Twenty callers reaching for one seat: one winner, one row.** Not nineteen
retries and a duplicate; the conditional `INSERT … ON CONFLICT` still does the
whole job.

**A hold costs 5–11 ms** for one to four seats, against a warm local Postgres.
The added checks are index lookups on `SeatHold` and one `SessionSectionPricing`
row; they have not turned an atomic write into a transaction.

**Overlapping ranges split cleanly.** Two buyers reaching for four seats each
with three in common: one took four, the other five, **zero in both** — and
between them every free seat in the union. Partial success is the documented
behaviour, and it is only correct if no seat lands in two replies and none is
lost to nobody.

That last case is now a test. The existing single-seat race cannot catch it: with
one seat there is nothing to split. Run five times consecutively to be sure a
timing-dependent test is not a coin flip.

## 23. The two copies of a section's geometry

A section carries its seats twice, on purpose. `seatBlob` is the columnar
artifact the customer's canvas renders — version-addressed and cached forever.
`VenueSeat` rows are the identities that holds, order lines and issued tickets
point at. The client picks a **position in the blob** and sends that index; the
server resolves it against the **rows**.

If the two ever disagree by even one place, a buyer clicks one seat and holds
another. Nothing errors, nothing looks wrong, and they find out at the door. It
is the most invisible failure this subsystem can have, and the compiler that
produces both was only tested on its pure output — never on what lands in the
database.

`tests/api/seat-blob-integrity.test.ts` checks every seated section: the counts
agree, every column is the right length, **the label at blob position *i* is the
label of seat index *i***, positions match within the blob's rounding, indices
run contiguously from zero, and the row windows tile the section with nothing
uncovered.

All nine seeded sections pass — 6,548 seats. The test was then verified to
*fail*: corrupting a single label in one blob trips the identity check, and
reseeding clears it.

### The tolerance is not slack

`toSectionSeats` rounds coordinates to one decimal, to shrink an artifact served
with `immutable`. Half a tenth is therefore the widest legitimate difference, and
the check uses exactly that. A first pass used 0.01 and reported six of nine
sections mismatched — the instrument was wrong, not the data, and the labels
matched exactly the whole time.

## 24. The number on the seat is where the seat is

§13.12 argued that `seatOrigin` must be authored: which side holds seat 1 varies
by venue even within Iran, so the compiler is told rather than guessing. That
makes it exactly the setting that can be declared one way and compiled the
other with nothing to notice — every seat exists, the count is right, holds
work. Someone walks along row A looking for seat 12 and finds it at the far end.

And it is not a rendering bug: the direction is baked into the stored labels, so
it reaches the printed ticket and the usher's list too.

Every row of every seeded section is now checked: labels run **monotonically**
along the row, and in the direction the layout declared. Both origins are
covered on purpose — the seeded venues include one left-origin section, and
without it a compiler that ignored `seatOrigin` entirely would still pass.

Verified to fail: reversing the x coordinates of one row trips the direction
check.

### The axis is not always x

A rotated stand (`angle: 90`) runs down the screen — its seats vary in `y` and
barely at all in `x`. Sorting by `x` reads them in an arbitrary order and
reports perfectly good numbering as scrambled, which is what a first pass did to
the arena's east and west stands: `35,34,36,33`. Sorted along the axis that
actually varies, both are a clean `68,67,66…2,1`.

The check picks the axis by span, and asserts that at least one rotated row is
among those it examined — otherwise the rotation case could quietly stop being
covered.

## 25. Replaying what the pages actually send

§21 drove the buyer's journey over HTTP, and it passed while guest checkout was
broken — because it used the API as documented, not the URLs the components
build. The regression lived in the gap between those two.

So this replays the request set **extracted from the component source**:
`useSeatmap`, `BestAvailable`, `SeatMap` and `CheckoutForm`, in order, sharing
one cookie jar, as a guest with no account.

| request | result |
| --- | --- |
| `GET /api/layouts/{v}/overview` | 200 |
| `GET /api/sessions/{s}/availability` | 200 |
| `GET /api/sessions/{s}/holds` (restore) | 200 |
| `GET /api/layouts/{v}/sections/vip/seats` | 200 |
| `GET /api/sessions/{s}/sections/vip/status` | 200 |
| `POST /api/sessions/{s}/best-available` | 201 — «ویژه» ۷،۶ |
| `POST /api/discounts/validate` | 200 |
| `POST /api/orders` | 201 — ۱۱٬۰۰۰٬۰۰۰ |
| `POST /api/orders/{id}/pay` | 200 — gateway redirect |

### The cookie, specifically

`resolveHolderKey` mints `poster_holder` on the first hold, and the whole
restore-on-reload feature rests on it. Checked directly:

- a first visit holds nothing and comes back with the cookie set;
- after holding in **two** sections, the reload call returns both groups with
  their own deadlines — the multi-section selection of §17, over the wire;
- a second browser with no cookie sees an empty list **and** is refused those
  seats with `SEAT_TAKEN`.

That last line is the one that matters: the cookie decides who may *release* a
hold, never who may take one.
