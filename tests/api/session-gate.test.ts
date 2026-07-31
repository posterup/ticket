/**
 * Which showing an order is actually for.
 *
 * `createOrder` wrote `sessionId` straight from the request without checking
 * anything about it. Three separate holes, all confirmed against the running
 * database before this was written:
 *
 *  1. a session belonging to a *different event* was accepted, filing a paid
 *     order against a showing it had nothing to do with — and poisoning
 *     everything scoped by session: the check-in holder list, the refund queue,
 *     the cancellation notice;
 *  2. a **cancelled** session was accepted, so people could buy tickets to a
 *     show that had been called off — after the cancellation SMS had gone out,
 *     so they would never be told;
 *  3. a session the organiser had marked «تکمیل ظرفیت» or «به زودی» was
 *     accepted, because nothing read `availability` at all.
 */

import { it, expect, beforeAll, afterAll, afterEach } from "vitest";

import {
  describeApi,
  restoreInventory,
  trackVenue,
} from "./helpers";

let eventId = "";
let sessionId = "";
let alienEventId = "";
let alienSessionId = "";
let ticketTypeId = "";

const buyer = { buyerName: "آزمون سانس", buyerPhone: "09121117000" };
const created: string[] = [];

/**
 * Its own event, built and destroyed here.
 *
 * The first version of this suite picked a published event out of the database
 * and flipped its سانس to cancelled/FULL. That event was «رویداد سفارش», which
 * `orders.test.ts` creates — and, at the time, leaked seventeen copies of per
 * run. So this suite was mutating a *stale* copy from an earlier run while
 * `orders.test.ts` asserted against a fresh one, and eight of its nineteen
 * tests failed depending on which copy `findFirst` returned.
 *
 * (An earlier version of this comment blamed parallel file execution. That was
 * wrong: `vitest.config.ts` sets `fileParallelism: false`. The cause was
 * leaked fixtures, now cleaned up by `dropTrackedEvents`.)
 *
 * Either way the conclusion stands: a suite whose whole subject is mutating
 * session state cannot borrow a fixture anyone else reads.
 */
async function makeEvent(title: string) {
  const { db } = await import("@/lib/server/db");
  const workspace = await db.workspace.findFirstOrThrow({ select: { id: true } });
  const venue = await db.venue.create({
    data: { name: "سالن آزمون سانس", city: "تهران", address: "-", capacity: 50 },
  });
  trackVenue(venue.id);
  const event = await db.event.create({
    data: {
      workspaceId: workspace.id,
      venueId: venue.id,
      title,
      description: "",
      mode: "ONE_TIME",
      status: "PUBLISHED",
      sessions: {
        create: {
          startAt: new Date("2026-12-01T18:00:00.000Z"),
          endAt: new Date("2026-12-01T20:00:00.000Z"),
        },
      },
    },
    select: { id: true, sessions: { select: { id: true } } },
  });
  return { eventId: event.id, sessionId: event.sessions[0].id };
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");

  const mine = await makeEvent("آزمون دروازهٔ سانس");
  eventId = mine.eventId;
  sessionId = mine.sessionId;

  // A second event, purely so "a session from another event" is a real
  // session belonging to a real other event rather than a random seeded id.
  const other = await makeEvent("آزمون دروازهٔ سانس — دیگر");
  alienEventId = other.eventId;
  alienSessionId = other.sessionId;

  ticketTypeId = (
    await db.ticketType.create({
      data: {
        eventId,
        name: "عادی",
        price: 50_000,
        capacity: 100,
        salesStartAt: new Date("2020-01-01T00:00:00.000Z"),
        salesEndAt: new Date("2030-01-01T00:00:00.000Z"),
        category: "GENERAL",
      },
      select: { id: true },
    })
  ).id;
});

afterEach(async () => {
  if (!process.env.DATABASE_URL || !sessionId) return;
  const { db } = await import("@/lib/server/db");
  await db.eventSession.update({
    where: { id: sessionId },
    data: { cancelled: false, availability: "AVAILABLE" },
  });
  if (created.length) {
    await restoreInventory(created);
    await db.ticket.deleteMany({ where: { orderId: { in: created } } });
    await db.orderItem.deleteMany({ where: { orderId: { in: created } } });
    await db.order.deleteMany({ where: { id: { in: created } } });
    created.length = 0;
  }
  await db.attendee.deleteMany({ where: { phone: buyer.buyerPhone } });
});

afterAll(async () => {
  if (!process.env.DATABASE_URL || !eventId) return;
  const { db } = await import("@/lib/server/db");
  const events = [eventId, alienEventId].filter(Boolean);
  await db.ticketType.deleteMany({ where: { eventId: { in: events } } });
  await db.eventSession.deleteMany({ where: { eventId: { in: events } } });
  await db.event.deleteMany({ where: { id: { in: events } } });
  // Both venues share the name, so one delete catches the pair.
  await db.venue.deleteMany({ where: { name: "سالن آزمون سانس" } });
});

async function order(session: string | undefined) {
  const { createOrder } = await import("@/lib/server/orders");
  const result = await createOrder({
    eventId,
    sessionId: session,
    items: [{ ticketTypeId, quantity: 1 }],
    ...buyer,
  });
  created.push(result.order.id);
  return result;
}

describeApi("which showing an order is for", () => {
  it("refuses a session from another event", async () => {
    if (!alienSessionId) return;
    await expect(order(alienSessionId)).rejects.toThrow(
      /سانس انتخابی برای این رویداد نیست/,
    );
  });

  it("refuses a cancelled سانس", async () => {
    const { db } = await import("@/lib/server/db");
    await db.eventSession.update({
      where: { id: sessionId },
      data: { cancelled: true },
    });
    await expect(order(sessionId)).rejects.toThrow(/لغو شده/);
  });

  it("refuses a سانس the organiser marked «تکمیل ظرفیت»", async () => {
    const { db } = await import("@/lib/server/db");
    await db.eventSession.update({
      where: { id: sessionId },
      data: { availability: "FULL" },
    });
    await expect(order(sessionId)).rejects.toThrow(/ظرفیت این سانس تکمیل/);
  });

  it("refuses a سانس that has not opened yet", async () => {
    const { db } = await import("@/lib/server/db");
    await db.eventSession.update({
      where: { id: sessionId },
      data: { availability: "SOON" },
    });
    await expect(order(sessionId)).rejects.toThrow(/هنوز آغاز نشده/);
  });

  it("still sells an «almost-full» سانس", async () => {
    const { db } = await import("@/lib/server/db");
    // An urgency hint meant to sell faster. Treating it as a stop would invert
    // what the organiser asked for.
    await db.eventSession.update({
      where: { id: sessionId },
      data: { availability: "ALMOST_FULL" },
    });
    const result = await order(sessionId);
    expect(result.order.id).toBeTruthy();
  });

  it("sells an open سانس", async () => {
    const result = await order(sessionId);
    expect(result.order.sessionId).toBe(sessionId);
  });

  it("still allows an order that names no سانس at all", async () => {
    // Half the paid orders in this database have no sessionId; a guard that
    // required one would break every one-off event's checkout.
    const result = await order(undefined);
    expect(result.order.id).toBeTruthy();
  });
});
