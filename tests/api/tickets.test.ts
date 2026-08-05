import { it, expect, beforeAll, afterAll } from "vitest";

import { GET, POST } from "@/app/api/tickets/route";
import { PATCH } from "@/app/api/tickets/[id]/route";
import type { TicketType } from "@/types";

import { ctx, data, errorCode, parse, req , describeApi , signInAsOwner } from "./helpers";

const SEED_EVENT = "3f1a6c2e-0001-4a10-9b21-1a2b3c4d5e01";

// Organiser-side endpoints: run as the seeded owner.
beforeAll(async () => {
  if (process.env.DATABASE_URL) await signInAsOwner();
});

const validTicket = {
  eventId: SEED_EVENT,
  name: "عادی",
  price: 150_000,
  capacity: 50,
  salesStartAt: "2026-08-01T00:00:00.000Z",
  salesEndAt: "2026-10-02T15:00:00.000Z",
  category: "general",
};

async function createTicket(overrides: Record<string, unknown> = {}) {
  const parsed = await parse<TicketType>(
    await POST(req("POST", "/api/tickets", { ...validTicket, ...overrides })),
  );
  expect(parsed.status).toBe(201);
  const type = data(parsed);
  madeTypes.push(type.id);
  return type;
}

/**
 * The POST cases create real ticket types on a *seeded* event, so the shared
 * event teardown never sees them: five accumulated per run, inflating every
 * capacity and price-from figure derived from that event.
 */
const madeTypes: string[] = [];

afterAll(async () => {
  if (!process.env.DATABASE_URL || !madeTypes.length) return;
  const { db } = await import("@/lib/server/db");
  await db.orderItem.deleteMany({ where: { ticketTypeId: { in: madeTypes } } });
  await db.ticketType.deleteMany({ where: { id: { in: madeTypes } } });
  madeTypes.length = 0;
});

describeApi("GET /api/tickets", () => {
  it("requires an eventId", async () => {
    // Unfiltered, this used to return every ticket type in the system —
    // prices and capacities for unpublished events included.
    const parsed = await parse<TicketType[]>(await GET(req("GET", "/api/tickets")));
    expect(parsed.status).toBe(400);
    expect(errorCode(parsed)).toBe("INVALID_QUERY");
  });

  it("filters by eventId", async () => {
    const scoped = data(
      await parse<TicketType[]>(
        await GET(req("GET", `/api/tickets?eventId=${SEED_EVENT}`)),
      ),
    );
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every((t) => t.eventId === SEED_EVENT)).toBe(true);
  });

  it("404s an unknown event rather than returning an empty list", async () => {
    const parsed = await parse<TicketType[]>(
      await GET(req("GET", "/api/tickets?eventId=nope")),
    );
    expect(parsed.status).toBe(404);
  });

  it("serves a published event's tickets to an anonymous visitor", async () => {
    // The public event page needs these, so `event:read` is the bar, not
    // `tickets:manage`.
    const { signOut } = await import("./helpers");
    await signOut();
    const parsed = await parse<TicketType[]>(
      await GET(req("GET", `/api/tickets?eventId=${SEED_EVENT}`)),
    );
    expect(parsed.status).toBe(200);
    await signInAsOwner();
  });

  it("refuses an anonymous caller the right to create one", async () => {
    const { signOut } = await import("./helpers");
    await signOut();
    const parsed = await parse<TicketType>(
      await POST(req("POST", "/api/tickets", validTicket)),
    );
    if (!("error" in parsed.body)) madeTypes.push(parsed.body.data.id);
    expect(parsed.status).toBe(401);
    await signInAsOwner();
  });
});

describeApi("POST /api/tickets", () => {
  it("creates a ticket type", async () => {
    const ticket = await createTicket();
    expect(ticket.name).toBe("عادی");
    expect(ticket.price).toBe(150_000);
    expect(ticket.eventId).toBe(SEED_EVENT);
  });

  it("accepts a free ticket priced at zero", async () => {
    const ticket = await createTicket({ price: 0 });
    expect(ticket.price).toBe(0);
  });

  it("rejects a negative price", async () => {
    const parsed = await parse<TicketType>(
      await POST(req("POST", "/api/tickets", { ...validTicket, price: -1 })),
    );
    expect(parsed.status).toBe(400);
    expect(errorCode(parsed)).toBe("INVALID_BODY");
  });

  it("rejects a fractional price", async () => {
    const parsed = await parse<TicketType>(
      await POST(req("POST", "/api/tickets", { ...validTicket, price: 1.5 })),
    );
    expect(errorCode(parsed)).toBe("INVALID_BODY");
  });

  it("rejects an unknown category", async () => {
    const parsed = await parse<TicketType>(
      await POST(req("POST", "/api/tickets", { ...validTicket, category: "royal" })),
    );
    expect(errorCode(parsed)).toBe("INVALID_BODY");
  });

  it("rejects a malformed sales timestamp", async () => {
    const parsed = await parse<TicketType>(
      await POST(
        req("POST", "/api/tickets", { ...validTicket, salesStartAt: "soon" }),
      ),
    );
    expect(errorCode(parsed)).toBe("INVALID_BODY");
  });

  it("rejects malformed JSON", async () => {
    const parsed = await parse(await POST(req("POST", "/api/tickets", "{oops")));
    expect(errorCode(parsed)).toBe("INVALID_JSON");
  });
});

describeApi("PATCH /api/tickets/:id", () => {
  it("edits price and capacity", async () => {
    const ticket = await createTicket();
    const parsed = await parse<TicketType>(
      await PATCH(
        req("PATCH", "/", { price: 200_000, capacity: 80 }),
        ctx({ id: ticket.id }),
      ),
    );
    const updated = data(parsed);
    expect(updated.price).toBe(200_000);
    expect(updated.capacity).toBe(80);
    expect(updated.name).toBe("عادی");
  });

  it("rejects a sales window that ends before it starts", async () => {
    const ticket = await createTicket();
    const parsed = await parse<TicketType>(
      await PATCH(
        req("PATCH", "/", {
          salesStartAt: "2026-10-01T00:00:00.000Z",
          salesEndAt: "2026-09-01T00:00:00.000Z",
        }),
        ctx({ id: ticket.id }),
      ),
    );
    expect(parsed.status).toBe(400);
    expect(errorCode(parsed)).toBe("INVALID_BODY");
  });

  it("rejects an empty patch", async () => {
    const ticket = await createTicket();
    const parsed = await parse<TicketType>(
      await PATCH(req("PATCH", "/", {}), ctx({ id: ticket.id })),
    );
    expect(errorCode(parsed)).toBe("INVALID_BODY");
  });

  it("404s an unknown ticket type", async () => {
    const parsed = await parse<TicketType>(
      await PATCH(req("PATCH", "/", { price: 1 }), ctx({ id: "nope" })),
    );
    expect(parsed.status).toBe(404);
    expect(errorCode(parsed)).toBe("NOT_FOUND");
  });
});
