/**
 * Unwinding a sale.
 *
 * Every order here is built by this suite through the real flow — hold, order,
 * settle — and torn down afterwards. Refunding a *seeded* order would mutate
 * counters other suites assert against, and the whole point of a refund is that
 * it changes inventory.
 */

import { it, expect, beforeAll, afterEach } from "vitest";

import { POST as HOLD } from "@/app/api/sessions/[id]/holds/route";
import { POST as REFUND } from "@/app/api/orders/[id]/refund/route";
import { GET as REFUND_QUEUE } from "@/app/api/events/[id]/refunds/route";
import { POST as CREATE_ORDER } from "@/app/api/orders/route";
import type { HoldResult, Order } from "@/types";

import { ctx, data, describeApi, parse, req, restoreInventory } from "./helpers";

let sessionId = "";
let eventId = "";
let section = "";
let ticketTypeId = "";

const buyer = { buyerName: "آزمون بازپرداخت", buyerPhone: "09121119000" };
const created: string[] = [];

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");
  // Ordered, and wide enough for the seat indices below. An unordered
  // `findFirst` picked a different showing per run, and the 236-seat theatre
  // stalls has no seat 300 — the suite passed or failed on which one it drew.
  const session = await db.eventSession.findFirst({
    where: {
      layoutVersionId: { not: null },
      event: { status: "PUBLISHED" },
      layoutVersion: { sections: { some: { kind: "SEATED", seatCount: { gt: 400 } } } },
    },
    orderBy: { id: "asc" },
    select: { id: true, eventId: true },
  });
  if (!session) return;
  sessionId = session.id;
  eventId = session.eventId;

  const now = new Date();
  const pricing = await db.sessionSectionPricing.findFirst({
    where: {
      eventId,
      ticketType: { salesStartAt: { lte: now }, salesEndAt: { gte: now } },
      section: { kind: "SEATED", seatCount: { gt: 400 } },
    },
    select: { ticketTypeId: true, section: { select: { key: true } } },
  });
  section = pricing?.section.key ?? "";
  ticketTypeId = pricing?.ticketTypeId ?? "";
});

afterEach(async () => {
  if (!process.env.DATABASE_URL || !sessionId) return;
  const { db } = await import("@/lib/server/db");
  await db.seatHold.deleteMany({ where: { sessionId } });
  await db.seatStatus.deleteMany({ where: { sessionId } });
  if (created.length) {
    // Before the rows go: deleting an order does not give its inventory back.
    await restoreInventory(created);
    await db.checkIn.deleteMany({
      where: { ticket: { orderId: { in: created } } },
    });
    await db.ticket.deleteMany({ where: { orderId: { in: created } } });
    await db.orderItem.deleteMany({ where: { orderId: { in: created } } });
    await db.order.deleteMany({ where: { id: { in: created } } });
    created.length = 0;
  }
  await db.attendee.deleteMany({ where: { phone: buyer.buyerPhone } });
});

/** Hold seats, order them, settle — a real paid order with real seats. */
async function paidOrder(seats: number[]): Promise<Order> {
  const { db } = await import("@/lib/server/db");
  const { markOrderPaid } = await import("@/lib/server/orders");

  data(
    await parse<HoldResult>(
      await HOLD(req("POST", "/", { section, seats }), ctx({ id: sessionId })),
    ),
  );

  const parsed = await parse<{ order: Order }>(
    await CREATE_ORDER(
      req("POST", "/api/orders", {
        eventId,
        sessionId,
        seats: [{ section, seats }],
        ...buyer,
      }),
    ),
  );
  const { order } = data(parsed);
  created.push(order.id);

  await markOrderPaid(order.id, {
    provider: "mock",
    authority: `refund-test-${order.id}`,
  });
  const settled = await db.order.findUniqueOrThrow({
    where: { id: order.id },
    select: { status: true },
  });
  expect(settled.status).toBe("PAID");
  return order;
}

const soldCount = async () => {
  const { db } = await import("@/lib/server/db");
  const t = await db.ticketType.findUniqueOrThrow({
    where: { id: ticketTypeId },
    select: { sold: true },
  });
  return t.sold;
};

describeApi("refunds", () => {
  it("returns the seats, voids the tickets, and decrements sold", async () => {
    const { db } = await import("@/lib/server/db");
    const { refundOrder } = await import("@/lib/server/refunds");

    const before = await soldCount();
    const order = await paidOrder([300, 301]);
    expect(await soldCount()).toBe(before + 2);
    expect(await db.seatStatus.count({ where: { orderId: order.id } })).toBe(2);

    const result = await refundOrder(order.id, { notify: false });

    expect(result.tickets).toBe(2);
    expect(result.seats).toBe(2);
    expect(result.amount).toBe(order.total);

    // Sold is back where it started — the number every capacity figure derives
    // from, and the one a double refund would corrupt.
    expect(await soldCount()).toBe(before);
    // The seat is genuinely back on sale, not merely marked.
    expect(await db.seatStatus.count({ where: { orderId: order.id } })).toBe(0);

    const tickets = await db.ticket.findMany({
      where: { orderId: order.id },
      select: { status: true },
    });
    expect(tickets).toHaveLength(2);
    for (const t of tickets) expect(t.status).toBe("REFUNDED");

    const after = await db.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true },
    });
    expect(after.status).toBe("REFUNDED");
  });

  it("refuses a second refund, so sold cannot drift", async () => {
    const { refundOrder } = await import("@/lib/server/refunds");
    const before = await soldCount();
    const order = await paidOrder([310, 311]);

    await refundOrder(order.id, { notify: false });
    await expect(refundOrder(order.id, { notify: false })).rejects.toThrow();

    expect(await soldCount()).toBe(before);
  });

  it("refuses an order that was never paid", async () => {
    const { db } = await import("@/lib/server/db");
    const { refundOrder } = await import("@/lib/server/refunds");

    data(
      await parse<HoldResult>(
        await HOLD(
          req("POST", "/", { section, seats: [320] }),
          ctx({ id: sessionId }),
        ),
      ),
    );
    const { order } = data(
      await parse<{ order: Order }>(
        await CREATE_ORDER(
          req("POST", "/api/orders", {
            eventId,
            sessionId,
            seats: [{ section, seats: [320] }],
            ...buyer,
          }),
        ),
      ),
    );
    created.push(order.id);

    await expect(refundOrder(order.id, { notify: false })).rejects.toThrow();
    const still = await db.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true },
    });
    expect(still.status).toBe("PENDING_PAYMENT");
  });

  it("stops a refunded ticket at the door", async () => {
    const { db } = await import("@/lib/server/db");
    const { refundOrder } = await import("@/lib/server/refunds");
    const { setCheckinByToken } = await import("@/lib/server/checkins");

    const order = await paidOrder([330]);
    const ticket = await db.ticket.findFirstOrThrow({
      where: { orderId: order.id },
      select: { qrToken: true },
    });

    // Admitted fine before the refund.
    const ok = await setCheckinByToken(eventId, ticket.qrToken, true);
    expect(ok.ok).toBe(true);

    await refundOrder(order.id, { notify: false });

    const refused = await setCheckinByToken(eventId, ticket.qrToken, true);
    expect(refused.ok).toBe(false);
    // The token still resolves — "this ticket is void" beats "unknown code"
    // for someone standing at a door holding a phone.
    if (!refused.ok) expect(refused.reason).toBe("not-valid");
  });

  it("frees the seat for the next buyer", async () => {
    const { refundOrder } = await import("@/lib/server/refunds");
    const order = await paidOrder([340]);

    // Sold, so unavailable.
    const blocked = await HOLD(
      req("POST", "/", { section, seats: [340] }),
      ctx({ id: sessionId }),
    );
    expect(blocked.status).toBe(409);

    await refundOrder(order.id, { notify: false });

    const freed = data(
      await parse<HoldResult>(
        await HOLD(
          req("POST", "/", { section, seats: [340] }),
          ctx({ id: sessionId }),
        ),
      ),
    );
    expect(freed.acquired).toEqual([340]);
  });

  it("lists who is owed money, flagging anyone already admitted", async () => {
    const { db } = await import("@/lib/server/db");
    const { refundQueue } = await import("@/lib/server/refunds");
    const { setCheckinByToken } = await import("@/lib/server/checkins");

    const order = await paidOrder([350, 351]);
    const ticket = await db.ticket.findFirstOrThrow({
      where: { orderId: order.id },
      select: { qrToken: true },
    });
    await setCheckinByToken(eventId, ticket.qrToken, true);

    const queue = await refundQueue(eventId, sessionId);
    const mine = queue.find((q) => q.orderId === order.id);

    expect(mine).toBeDefined();
    expect(mine!.tickets).toBe(2);
    expect(mine!.total).toBe(order.total);
    expect(mine!.checkedIn).toBe(1);
  });

  it("refuses an anonymous caller — this voids other people's tickets", async () => {
    const { db } = await import("@/lib/server/db");
    const order = await paidOrder([370]);

    const res = await REFUND(
      req("POST", "/", {}),
      ctx({ id: order.id }),
    );
    // 401 unauthenticated, or 403 for a signed-in non-organiser. Never 200.
    expect([401, 403]).toContain(res.status);

    const untouched = await db.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true },
    });
    expect(untouched.status).toBe("PAID");
  });

  it("refuses an anonymous caller the list of who paid", async () => {
    // The queue carries buyer names and phone numbers.
    const res = await REFUND_QUEUE(req("GET", "/"), ctx({ id: eventId }));
    expect([401, 403]).toContain(res.status);
  });

  it("drops out of the queue once refunded", async () => {
    const { refundQueue } = await import("@/lib/server/refunds");
    const order = await paidOrder([360]);

    expect(
      (await refundQueue(eventId, sessionId)).some(
        (q) => q.orderId === order.id,
      ),
    ).toBe(true);

    const { refundOrder } = await import("@/lib/server/refunds");
    await refundOrder(order.id, { notify: false });

    expect(
      (await refundQueue(eventId, sessionId)).some(
        (q) => q.orderId === order.id,
      ),
    ).toBe(false);
  });
});
