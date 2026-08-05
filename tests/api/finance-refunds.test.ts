/**
 * What a refund does to the organiser's money.
 *
 * `net` subtracted refunds from a total that had already lost them: a refunded
 * order leaves `PAID`, so it was gone from the paid aggregate *and* deducted
 * again as `refunds`. Refunding ۲۰۰٬۰۰۰ moved the payable balance by ۳۹۴٬۰۰۰.
 *
 * It was unreachable while nothing could set `REFUNDED` — which is why it
 * survived — and went live the moment refunds did. Arithmetic that is only
 * wrong once a neighbouring feature ships is exactly what needs a test.
 */

import { it, expect, beforeAll, afterEach } from "vitest";

import { describeApi, restoreInventory } from "./helpers";

let workspaceId = "";
let eventId = "";
let ticketTypeId = "";

const buyer = { buyerName: "آزمون مالی", buyerPhone: "09121116000" };
const created: string[] = [];

const FEE_RATE = 0.03;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");
  const now = new Date();
  const type = await db.ticketType.findFirst({
    where: {
      price: { gt: 0 },
      salesStartAt: { lte: now },
      salesEndAt: { gte: now },
      sectionPricing: { none: {} },
      event: {
        status: "PUBLISHED",
        // Not an invite-only event: `createOrder` routes those to a join
        // request, and this suite is about money, not the approval gate.
        requiresApproval: false,
        visibility: "PUBLIC",
        sessions: { none: { cancelled: true } },
      },
    },
    // Deterministic. Without an order, `findFirst` returned a different event
    // per run and the suite passed or failed on whichever it happened to get.
    orderBy: { id: "asc" },
    select: { id: true, eventId: true, event: { select: { workspaceId: true } } },
  });
  if (!type) return;
  ticketTypeId = type.id;
  eventId = type.eventId;
  workspaceId = type.event.workspaceId;
});

afterEach(async () => {
  if (!process.env.DATABASE_URL || !created.length) return;
  const { db } = await import("@/lib/server/db");
  await restoreInventory(created);
  await db.ticket.deleteMany({ where: { orderId: { in: created } } });
  await db.orderItem.deleteMany({ where: { orderId: { in: created } } });
  await db.order.deleteMany({ where: { id: { in: created } } });
  created.length = 0;
  await db.attendee.deleteMany({ where: { phone: buyer.buyerPhone } });
});

/** A settled order of a known value. */
async function sale() {
  const { createOrder, markOrderPaid } = await import("@/lib/server/orders");
  const result = await createOrder({
    eventId,
    items: [{ ticketTypeId, quantity: 1 }],
    ...buyer,
  });
  created.push(result.order.id);
  await markOrderPaid(result.order.id, {
    provider: "mock",
    authority: `fin-${result.order.id}`,
  });
  return result.order;
}

describeApi("refunds and the wallet", () => {
  it("debits the organiser once, not twice", async () => {
    const { computeFinance } = await import("@/lib/server/finance");
    const { refundOrder } = await import("@/lib/server/refunds");

    const order = await sale();
    const before = await computeFinance(workspaceId);

    await refundOrder(order.id, { notify: false });
    const after = await computeFinance(workspaceId);

    // The organiser loses what they gave back, less the commission they are no
    // longer paying on it. Not twice the refund.
    const expected = order.total - Math.round(order.total * FEE_RATE);
    expect(before.net - after.net).toBe(expected);
    expect(before.net - after.net).toBeLessThan(order.total);
  });

  it("leaves gross alone — the money did come through the door", async () => {
    const { computeFinance } = await import("@/lib/server/finance");
    const { refundOrder } = await import("@/lib/server/refunds");

    const order = await sale();
    const before = await computeFinance(workspaceId);

    await refundOrder(order.id, { notify: false });
    const after = await computeFinance(workspaceId);

    expect(after.gross).toBe(before.gross);
    expect(after.refunds).toBe(before.refunds + order.total);
  });

  it("charges no commission on refunded money", async () => {
    const { computeFinance } = await import("@/lib/server/finance");
    const { refundOrder } = await import("@/lib/server/refunds");

    const order = await sale();
    const before = await computeFinance(workspaceId);

    await refundOrder(order.id, { notify: false });
    const after = await computeFinance(workspaceId);

    // Taking a cut of money that was handed back is a penalty, not a fee.
    expect(before.fee - after.fee).toBe(Math.round(order.total * FEE_RATE));
  });

  it("keeps net equal to kept minus fee at all times", async () => {
    const { computeFinance } = await import("@/lib/server/finance");
    const { refundOrder } = await import("@/lib/server/refunds");

    const order = await sale();
    for (const stage of ["before", "after"] as const) {
      if (stage === "after") await refundOrder(order.id, { notify: false });
      const f = await computeFinance(workspaceId);
      const kept = f.gross - f.refunds;
      expect(f.fee).toBe(Math.round(kept * FEE_RATE));
      expect(f.net).toBe(Math.max(0, kept - f.fee));
    }
  });

  it("never reports a negative balance", async () => {
    const { computeFinance } = await import("@/lib/server/finance");
    const f = await computeFinance(workspaceId);
    expect(f.net).toBeGreaterThanOrEqual(0);
    expect(f.balance).toBeGreaterThanOrEqual(0);
  });
});
