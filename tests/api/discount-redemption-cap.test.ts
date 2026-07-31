/**
 * «ظرفیت استفاده» has to be a limit, not a suggestion.
 *
 * `maxRedemptions` is *checked* when the order is created and `redemptions` is
 * *incremented* when the order is paid. Between those two moments the counter
 * does not move, so every order placed in that window sees the same stale
 * count and passes the same check. A code capped at one is redeemed by however
 * many people place an order before the first of them pays.
 *
 * This is not a narrow race. The window is the entire payment round-trip —
 * `HOLD_MINUTES`, a redirect to the gateway, and a human typing card details —
 * so for a code worth having ("first 50 buyers", a press allocation, a partner
 * rate) the overshoot is not one or two but everyone who arrived in the first
 * few minutes. The organiser set a budget and the platform ignored it.
 *
 * The fix mirrors what `TicketType.reserved` already does for seats: claim the
 * redemption when the order is created, release it if the order lapses. The
 * codebase's own idiom for "spoken for but not yet settled".
 */

import { it, expect, beforeAll, afterAll, afterEach } from "vitest";

import { POST as CREATE_ORDER } from "@/app/api/orders/route";
import type { Order } from "@/types";

import { data, describeApi, errorCode, parse, req } from "./helpers";

let eventId = "";
let ticketTypeId = "";
let workspaceId = "";
let codeId = "";

const CODE = "CAPTEST1";

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");

  const base = await db.event.findFirst({
    where: { status: "PUBLISHED" },
    select: { id: true, workspaceId: true, venueId: true },
  });
  if (!base) return;
  workspaceId = base.workspaceId;

  const now = Date.now();
  const event = await db.event.create({
    data: {
      workspaceId,
      venueId: base.venueId,
      title: "رویداد سقف تخفیف (آزمون)",
      description: "آزمون ظرفیت کد تخفیف",
      status: "PUBLISHED",
      mode: "ONE_TIME",
      ticketTypes: {
        create: {
          name: "عادی",
          price: 200_000,
          capacity: 100,
          salesStartAt: new Date(now - 86_400_000),
          salesEndAt: new Date(now + 86_400_000),
          category: "GENERAL",
        },
      },
    },
    select: { id: true, ticketTypes: { select: { id: true } } },
  });
  eventId = event.id;
  ticketTypeId = event.ticketTypes[0].id;
});

afterEach(async () => {
  if (!process.env.DATABASE_URL || !eventId) return;
  const { db } = await import("@/lib/server/db");
  const orders = await db.order.findMany({ where: { eventId }, select: { id: true } });
  const ids = orders.map((o) => o.id);
  await db.discountRedemption.deleteMany({ where: { orderId: { in: ids } } });
  await db.ticket.deleteMany({ where: { orderId: { in: ids } } });
  await db.orderItem.deleteMany({ where: { orderId: { in: ids } } });
  await db.order.deleteMany({ where: { id: { in: ids } } });
  await db.discountCode.deleteMany({ where: { code: CODE } });
  await db.ticketType.updateMany({
    where: { eventId },
    data: { sold: 0, reserved: 0 },
  });
  codeId = "";
});

afterAll(async () => {
  if (!process.env.DATABASE_URL || !eventId) return;
  const { db } = await import("@/lib/server/db");
  await db.ticketType.deleteMany({ where: { eventId } });
  await db.event.deleteMany({ where: { id: eventId } });
});

/** A code good for `maxRedemptions` uses across the whole workspace. */
async function makeCode(maxRedemptions: number | null) {
  const { db } = await import("@/lib/server/db");
  const row = await db.discountCode.create({
    data: {
      workspaceId,
      eventId,
      code: CODE,
      kind: "PERCENT",
      value: 50,
      maxRedemptions,
      active: true,
    },
    select: { id: true },
  });
  codeId = row.id;
  return row.id;
}

function order(phone: string) {
  return CREATE_ORDER(
    req("POST", "/api/orders", {
      eventId,
      items: [{ ticketTypeId, quantity: 1 }],
      buyerName: "خریدار",
      buyerPhone: phone,
      discountCode: CODE,
    }),
  );
}

async function redemptionsOf(id: string): Promise<number> {
  const { db } = await import("@/lib/server/db");
  const row = await db.discountCode.findUniqueOrThrow({
    where: { id },
    select: { redemptions: true },
  });
  return row.redemptions;
}

describeApi("a discount code's redemption cap", () => {
  it("refuses the second order while the first is still unpaid", async () => {
    const id = await makeCode(1);

    const first = await parse<{ order: Order }>(await order("09121110001"));
    expect(first.status).toBe(201);

    // Nobody has paid, so `redemptions` is still 0 — which is exactly the
    // stale read the old check trusted.
    expect(await redemptionsOf(id)).toBe(0);

    const second = await parse(await order("09121110002"));
    expect(second.status).toBe(409);
    expect(errorCode(second)).toBe("DISCOUNT_EXHAUSTED");
  });

  it("never lets the settled count exceed the cap", async () => {
    const id = await makeCode(2);
    const { markOrderPaid } = await import("@/lib/server/orders");

    const placed: string[] = [];
    for (const phone of ["09121110003", "09121110004", "09121110005"]) {
      const parsed = await parse<{ order: Order }>(await order(phone));
      if (parsed.status === 201) placed.push(data(parsed).order.id);
    }

    // Only two may ever be placed against a cap of two.
    expect(placed).toHaveLength(2);

    for (const orderId of placed) {
      await markOrderPaid(orderId, { provider: "mock" });
    }
    expect(await redemptionsOf(id)).toBe(2);
  });

  it("gives the claim back when an order lapses", async () => {
    const id = await makeCode(1);
    const { db } = await import("@/lib/server/db");

    const first = await parse<{ order: Order }>(await order("09121110006"));
    expect(first.status).toBe(201);
    expect(errorCode(await parse(await order("09121110007")))).toBe(
      "DISCOUNT_EXHAUSTED",
    );

    // The buyer walks away and the order expires. A claim that is never
    // released is a code that dies with its first abandoned checkout — the
    // opposite failure, and just as bad for the organiser.
    await db.order.update({
      where: { id: data(first).order.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const { releaseExpiredOrders } = await import("@/lib/server/orders");
    await releaseExpiredOrders();

    const retry = await parse<{ order: Order }>(await order("09121110008"));
    expect(retry.status).toBe(201);
  });

  it("leaves an uncapped code uncapped", async () => {
    const id = await makeCode(null);
    for (const phone of ["09121110009", "09121110010", "09121110011"]) {
      expect((await parse(await order(phone))).status).toBe(201);
    }
    expect(await redemptionsOf(id)).toBe(0);
  });
});
