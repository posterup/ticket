import { it, expect } from "vitest";

import { GET, POST } from "@/app/api/tickets/route";
import { PATCH } from "@/app/api/tickets/[id]/route";
import type { TicketType } from "@/types";

import { ctx, data, errorCode, parse, req , describeApi } from "./helpers";

const SEED_EVENT = "3f1a6c2e-0001-4a10-9b21-1a2b3c4d5e01";

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
  return data(parsed);
}

describeApi("GET /api/tickets", () => {
  it("lists every ticket type when unfiltered", async () => {
    const all = data(await parse<TicketType[]>(await GET(req("GET", "/api/tickets"))));
    expect(all.length).toBeGreaterThan(0);
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

  it("returns an empty list for an unknown event", async () => {
    const scoped = data(
      await parse<TicketType[]>(await GET(req("GET", "/api/tickets?eventId=nope"))),
    );
    expect(scoped).toEqual([]);
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
