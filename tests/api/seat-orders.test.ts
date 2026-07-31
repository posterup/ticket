import { it, expect, beforeAll, afterEach } from "vitest";

import { POST as HOLD } from "@/app/api/sessions/[id]/holds/route";
import { POST as CREATE_ORDER } from "@/app/api/orders/route";
import type { HoldResult, Order } from "@/types";

import { ctx, data, describeApi, errorCode, parse, req, restoreInventory } from "./helpers";

let sessionId = "";
let eventId = "";
/**
 * Resolved, not hardcoded.
 *
 * A section is only buyable if the TicketType it maps to is currently on sale,
 * and the seeded windows are fixed dates — so pinning a section name here would
 * make the suite fail on a calendar boundary rather than on a real defect.
 */
let section = "";

const buyer = { buyerName: "آزمون خریدار", buyerPhone: "09121110000" };

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");
  const session = await db.eventSession.findFirst({
    where: { layoutVersionId: { not: null }, event: { status: "PUBLISHED" } },
    select: { id: true, layoutVersionId: true, eventId: true },
  });
  if (!session?.layoutVersionId) return;
  sessionId = session.id;
  eventId = session.eventId;

  const now = new Date();
  const pricing = await db.sessionSectionPricing.findMany({
    where: {
      eventId: session.eventId,
      ticketType: { salesStartAt: { lte: now }, salesEndAt: { gte: now } },
      section: { kind: "SEATED", seatCount: { gt: 200 } },
    },
    select: { section: { select: { key: true } } },
  });
  section = pricing[0]?.section.key ?? "";
});

/**
 * Only ever tear down what these tests made.
 *
 * Scoping cleanup to "every order for this event" would delete the seeded
 * fixtures other suites assert against — and blocks on the CheckIn foreign key
 * besides.
 */
const created: string[] = [];

afterEach(async () => {
  if (!process.env.DATABASE_URL || !sessionId) return;
  const { db } = await import("@/lib/server/db");
  await db.seatHold.deleteMany({ where: { sessionId } });
  await db.seatStatus.deleteMany({ where: { sessionId } });
  if (created.length) {
    // Before the rows go: deleting an order does not give its inventory back.
    await restoreInventory(created);
    await db.ticket.deleteMany({ where: { orderId: { in: created } } });
    await db.orderItem.deleteMany({ where: { orderId: { in: created } } });
    await db.order.deleteMany({ where: { id: { in: created } } });
    created.length = 0;
  }
  // Settlement upserts the buyer into the workspace CRM — intended in
  // production, fixture pollution here.
  await db.attendee.deleteMany({ where: { phone: buyer.buyerPhone } });
});

/** Place a seat order and remember it for teardown. */
async function placeOrder(seats: { section: string; seats: number[] }[]) {
  const parsed = await parse<{ order: Order; requiresPayment: boolean }>(
    await CREATE_ORDER(
      req("POST", "/api/orders", { eventId, sessionId, seats, ...buyer }),
    ),
  );
  if (!("error" in parsed.body)) created.push(parsed.body.data.order.id);
  return parsed;
}

describeApi("assigned-seating checkout", () => {
  it("turns held seats into an order priced from the section", async () => {
    const hold = data(
      await parse<HoldResult>(
        await HOLD(
          req("POST", "/", { section, seats: [100, 101] }),
          ctx({ id: sessionId }),
        ),
      ),
    );
    expect(hold.acquired).toEqual([100, 101]);

    const parsed = await placeOrder([{ section, seats: [100, 101] }]);
    expect(parsed.status).toBe(201);

    const { order } = data(parsed);
    // Two seats, one line, and a price the client never sent.
    expect(order.items).toHaveLength(1);
    expect(order.items[0].quantity).toBe(2);
    expect(order.items[0].unitPrice).toBeGreaterThan(0);
    expect(order.subtotal).toBe(order.items[0].unitPrice * 2);
  });

  it("buys seats in two different sections at once", async () => {
    // The picker used to keep one flat set of indices while the open section
    // moved independently, so a buyer could only ever hold one section's worth
    // — switching sections silently carried the old indices into the new view
    // and stranded the original holds. The order endpoint always accepted
    // several sections; nothing could produce the request.
    const { db } = await import("@/lib/server/db");
    const now = new Date();
    const priced = await db.sessionSectionPricing.findMany({
      where: {
        eventId,
        section: { kind: "SEATED" },
        ticketType: { salesStartAt: { lte: now }, salesEndAt: { gte: now } },
      },
      orderBy: { sectionId: "asc" },
      select: { section: { select: { key: true, seatCount: true } } },
    });
    const pair = priced.filter((p) => p.section.seatCount > 20).slice(0, 2);
    if (pair.length < 2) return;

    const [a, b] = pair.map((p) => p.section.key);
    for (const key of [a, b]) {
      const held = data(
        await parse<HoldResult>(
          await HOLD(
            req("POST", "/", { section: key, seats: [2, 3] }),
            ctx({ id: sessionId }),
          ),
        ),
      );
      expect(held.acquired).toEqual([2, 3]);
    }

    const parsed = await placeOrder([
      { section: a, seats: [2, 3] },
      { section: b, seats: [2, 3] },
    ]);
    expect(parsed.status).toBe(201);

    const { order } = data(parsed);
    expect(order.items.reduce((n, i) => n + i.quantity, 0)).toBe(4);
    // Two sections priced independently, so the total is not one price × four.
    expect(order.subtotal).toBeGreaterThan(0);
  });

  it("puts seats and standing tickets in one basket", async () => {
    // The arena has stands around a standing floor, so a basket may hold both.
    // createOrder used to take seats *or* items, never both, which made the
    // standing floor unbuyable on any mapped session.
    const { db } = await import("@/lib/server/db");
    const standingTicket = await db.sessionSectionPricing.findFirst({
      where: { eventId, section: { kind: "STANDING" } },
      select: { ticketTypeId: true },
    });
    // Only meaningful on a layout that actually has a standing section.
    if (!standingTicket) return;

    await HOLD(
      req("POST", "/", { section, seats: [180, 181] }),
      ctx({ id: sessionId }),
    );
    const parsed = await parse<{ order: Order }>(
      await CREATE_ORDER(
        req("POST", "/api/orders", {
          eventId,
          sessionId,
          seats: [{ section, seats: [180, 181] }],
          items: [{ ticketTypeId: standingTicket.ticketTypeId, quantity: 3 }],
          ...buyer,
        }),
      ),
    );
    if (!("error" in parsed.body)) created.push(parsed.body.data.order.id);
    expect(parsed.status).toBe(201);

    const total = data(parsed).order.items.reduce((n, i) => n + i.quantity, 0);
    expect(total).toBe(5);
  });

  it("refuses seats the caller does not hold", async () => {
    // No hold taken first — this is the "someone crafted a request" case.
    const parsed = await placeOrder([{ section, seats: [150] }]);
    expect(errorCode(parsed)).toBe("HOLD_EXPIRED");
  });

  it("binds the holds to the order so they survive the gateway trip", async () => {
    const { db } = await import("@/lib/server/db");
    await HOLD(
      req("POST", "/", { section, seats: [120] }),
      ctx({ id: sessionId }),
    );
    const { order } = data(
      await placeOrder([{ section, seats: [120] }]),
    );

    const bound = await db.seatHold.findMany({
      where: { orderId: order.id },
      select: { seatId: true },
    });
    expect(bound).toHaveLength(1);
  });

  it("issues one ticket per seat and marks the seats sold on settlement", async () => {
    const { db } = await import("@/lib/server/db");
    const { markOrderPaid } = await import("@/lib/server/orders");

    await HOLD(
      req("POST", "/", { section, seats: [130, 131] }),
      ctx({ id: sessionId }),
    );
    const { order } = data(
      await placeOrder([{ section, seats: [130, 131] }]),
    );

    await markOrderPaid(order.id, { provider: "test" });

    const tickets = await db.ticket.findMany({
      where: { orderId: order.id },
      select: { seatId: true, qrToken: true },
    });
    expect(tickets).toHaveLength(2);
    // Every ticket names the seat it admits to — the whole point.
    expect(tickets.every((t) => t.seatId)).toBe(true);
    expect(new Set(tickets.map((t) => t.seatId)).size).toBe(2);
    expect(new Set(tickets.map((t) => t.qrToken)).size).toBe(2);

    const sold = await db.seatStatus.findMany({
      where: { sessionId, orderId: order.id },
      select: { state: true },
    });
    expect(sold).toHaveLength(2);
    expect(sold.every((s) => s.state === "SOLD")).toBe(true);

    // The hold has done its job and is gone; SeatStatus keeps the seat off sale.
    expect(await db.seatHold.count({ where: { orderId: order.id } })).toBe(0);
  });

  it("will not sell the same seat twice", async () => {
    const { markOrderPaid } = await import("@/lib/server/orders");

    await HOLD(
      req("POST", "/", { section, seats: [140] }),
      ctx({ id: sessionId }),
    );
    const { order } = data(
      await placeOrder([{ section, seats: [140] }]),
    );
    await markOrderPaid(order.id, { provider: "test" });

    // Sold now, so it cannot even be held.
    const again = await parse<HoldResult>(
      await HOLD(
        req("POST", "/", { section, seats: [140] }),
        ctx({ id: sessionId }),
      ),
    );
    expect(errorCode(again)).toBe("SEAT_TAKEN");
  });

  it("returns seats to sale when a payment is declined", async () => {
    // Regression: the payment callback used to do its own inventory bookkeeping
    // and never touched SeatHold, so a declined card stranded the seats for the
    // full 20-minute hold TTL. All three release paths now share one function.
    const { releaseSeatInventory } = await import("@/lib/server/orders");
    const { db } = await import("@/lib/server/db");

    await HOLD(
      req("POST", "/", { section, seats: [170] }),
      ctx({ id: sessionId }),
    );
    const { order } = data(
      await placeOrder([{ section, seats: [170] }]),
    );
    expect(await db.seatHold.count({ where: { orderId: order.id } })).toBe(1);

    await releaseSeatInventory(order.id);
    expect(await db.seatHold.count({ where: { orderId: order.id } })).toBe(0);

    // And the seat is immediately takeable again.
    const retaken = await parse<HoldResult>(
      await HOLD(
        req("POST", "/", { section, seats: [170] }),
        ctx({ id: sessionId }),
      ),
    );
    expect(data(retaken).acquired).toEqual([170]);
  });

  it("returns seats to sale when the order is cancelled", async () => {
    const { cancelOrder } = await import("@/lib/server/orders");
    const { db } = await import("@/lib/server/db");

    await HOLD(
      req("POST", "/", { section, seats: [160] }),
      ctx({ id: sessionId }),
    );
    const { order } = data(
      await placeOrder([{ section, seats: [160] }]),
    );

    await cancelOrder(order.id);
    // Released outright, not left to lapse — a dead order must not sit on a
    // seat for the rest of its TTL.
    expect(await db.seatHold.count({ where: { orderId: order.id } })).toBe(0);

    const retaken = await parse<HoldResult>(
      await HOLD(
        req("POST", "/", { section, seats: [160] }),
        ctx({ id: sessionId }),
      ),
    );
    expect(data(retaken).acquired).toEqual([160]);
  });
});
