# Backend Architecture

This document describes the backend layer of **پوستر (Poster)** - a Persian-first
Event CRM & ticketing platform built on Next.js 15 (App Router), React 19 and
strict TypeScript.

## Frontend / backend separation

The App Router lets frontend and backend live in one Next.js project while
staying cleanly separated by directory and runtime:

- **Frontend** - React Server/Client Components under `app/` (pages, layouts,
  UI). Delivered on a separate branch.
- **Backend** - three server-only concerns, none of which import UI:
  - `types/` - the shared domain model (also consumed by the frontend for
    type-safety across the wire).
  - `lib/server/` - the data-access layer. Currently an **in-memory mock**;
    designed to be swapped for a real datastore without touching call sites.
  - `app/api/**/route.ts` - HTTP Route Handlers that validate input and return
    a consistent JSON envelope.

Data flows one way: `route handler → lib/server → store`. Route handlers never
contain business logic beyond request parsing; the data-access functions own it.

## Directory layout

```
types/
  api.ts        # ApiResponse<T> envelope, Money, IsoDateTime helpers
  event.ts      # Event, EventStatus, EventMode, Venue, EventSession, RecurrenceRule
  ticket.ts     # TicketType, TicketCategory, Ticket, TicketStatus
  attendee.ts   # Attendee (CRM contact), AttendeeTag, CustomField
  index.ts      # barrel re-export -> import from "@/types"

lib/server/
  store.ts      # in-memory seed arrays (events / ticket types / attendees)
  events.ts     # listEvents(), getEventById(id), createEvent(input)
  tickets.ts    # listTickets(eventId?), createTicketType(input)
  index.ts      # barrel re-export -> import from "@/lib/server"

app/api/
  events/route.ts        # GET (list), POST (create)
  events/[id]/route.ts   # GET (fetch one, 404 if missing)
  tickets/route.ts       # GET (?eventId= filter), POST (create ticket type)
```

## Domain model

An **Event** owns two independent axes, mirroring the 3-step creation wizard:

1. **Event info** - `title`, `description`, `venue`, `tags`, `status`.
2. **Schedule** - an `EventMode` of `one-time`, `recurring`, or `multi-session`.
   `recurring` events additionally carry a `RecurrenceRule`
   (`frequency: daily | weekly | monthly | weekday`, `interval`, `byDay`, and a
   bound of either `until` or `count`). Concrete occurrences are `EventSession`s.
3. **Ticket types** - an unbounded list of `TicketType`s per event, each with a
   `price` (integer Toman), `capacity`, sales window, and a `TicketCategory`
   (`general | vip | student | early-bird | backstage | group`).

Issued tickets (`Ticket`) reference a `TicketType` and carry a `qrToken` and
`TicketStatus`. CRM contacts (`Attendee`) are event-independent and hold `tags`,
`notes`, and organiser-defined `customFields`.

All dates are ISO 8601 strings. Money is an integer amount in Toman.

### API envelope

Every response is an `ApiResponse<T>`:

```ts
// success
{ "data": T }
// error
{ "error": { "message": string, "code": string } }
```

## API endpoints

| Method | Path               | Description                                         | Success |
| ------ | ------------------ | --------------------------------------------------- | ------- |
| GET    | `/api/events`      | List all events (newest first).                     | 200     |
| POST   | `/api/events`      | Create an event. Validates title/mode/venue/sessions. | 201   |
| GET    | `/api/events/{id}` | Fetch one event; `404` when not found.              | 200     |
| GET    | `/api/tickets`     | List ticket types; optional `?eventId=` filter.     | 200     |
| POST   | `/api/tickets`     | Create a ticket type for an event.                  | 201     |

Invalid JSON yields `400 { error.code: "INVALID_JSON" }`; a well-formed but
incomplete body yields `400 { error.code: "INVALID_BODY" }`.

### Sample: create an event

Request `POST /api/events`:

```json
{
  "title": "کنسرت شب موسیقی",
  "description": "اجرای زنده گروه موسیقی سنتی",
  "mode": "one-time",
  "venue": {
    "name": "تالار وحدت",
    "city": "تهران",
    "address": "تهران، خیابان حافظ، تالار وحدت",
    "capacity": 750
  },
  "sessions": [
    { "startAt": "2026-10-02T18:30:00.000Z", "endAt": "2026-10-02T21:00:00.000Z" }
  ],
  "tags": ["موسیقی"]
}
```

Response `201 Created`:

```json
{
  "data": {
    "id": "b6d2…",
    "title": "کنسرت شب موسیقی",
    "status": "draft",
    "mode": "one-time",
    "venue": { "id": "…", "name": "تالار وحدت", "city": "تهران", "address": "…", "capacity": 750 },
    "sessions": [{ "id": "…", "eventId": "b6d2…", "startAt": "…", "endAt": "…" }],
    "tags": ["موسیقی"],
    "createdAt": "2026-07-19T12:00:00.000Z",
    "updatedAt": "2026-07-19T12:00:00.000Z"
  }
}
```

### Sample: create a ticket type

Request `POST /api/tickets`:

```json
{
  "eventId": "b6d2…",
  "name": "بلیت عادی",
  "price": 1500000,
  "capacity": 500,
  "salesStartAt": "2026-08-01T00:00:00.000Z",
  "salesEndAt": "2026-10-02T15:00:00.000Z",
  "category": "general"
}
```

Response `201 Created`: `{ "data": { "id": "…", "eventId": "b6d2…", … } }`.

## Future work

- **Real datastore** - replace `lib/server/store.ts` and the array operations in
  `events.ts` / `tickets.ts` with a database (e.g. Postgres via Prisma or
  Drizzle). Call sites and types stay unchanged.
- **Authentication & authorization** - add session/organisation scoping so
  events and attendees are tenant-isolated; protect the `POST` handlers.
- **Server Actions for the wizard** - back the 3-step creation flow with typed
  Server Actions (progressive enhancement) in addition to the JSON API.
- **Richer validation** - introduce a schema validator (e.g. Zod) and surface
  field-level error details in the `error` envelope.
- **Ticket issuance & check-in** - endpoints to issue `Ticket`s, generate
  `qrToken`s, and transition `TicketStatus` at the door.
```
