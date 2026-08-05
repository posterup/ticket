/**
 * What a buyer sees after their show is called off.
 *
 * Cancelling a سانس sends an SMS and touches nothing else. The tickets stay
 * `ISSUED` — correctly, because it is the refund that voids them and that
 * happens later, by hand — so `/me/tickets` went on reporting «معتبر» over a
 * scannable code for a show that was not happening, and the door went on
 * admitting people to it.
 *
 * An SMS is not enough on its own: it can be missed, deleted, or sent to a
 * phone the buyer no longer carries. The app has to say it too.
 */

import { it, expect, beforeAll, afterAll, afterEach } from "vitest";

import {
  describeApi,
  restoreInventory,
  trackVenue,
} from "./helpers";

let eventId = "";
let sessionId = "";
let ticketTypeId = "";
let orderCode = "";
let qrToken = "";

const buyer = { buyerName: "آزمون لغو", buyerPhone: "09121115000" };
const created: string[] = [];

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");
  const { createOrder, markOrderPaid } = await import("@/lib/server/orders");

  // Its own event: this suite cancels showings, and a suite that mutates
  // session state must not borrow a fixture anyone else reads.
  const workspace = await db.workspace.findFirstOrThrow({ select: { id: true } });
  const venue = await db.venue.create({
    data: { name: "سالن آزمون لغو", city: "تهران", address: "-", capacity: 50 },
  });
  trackVenue(venue.id);
  const event = await db.event.create({
    data: {
      workspaceId: workspace.id,
      venueId: venue.id,
      title: "آزمون بلیت لغوشده",
      description: "",
      mode: "ONE_TIME",
      status: "PUBLISHED",
      sessions: {
        create: {
          startAt: new Date("2026-12-05T18:00:00.000Z"),
          endAt: new Date("2026-12-05T20:00:00.000Z"),
        },
      },
    },
    select: { id: true, sessions: { select: { id: true } } },
  });
  eventId = event.id;
  sessionId = event.sessions[0].id;

  ticketTypeId = (
    await db.ticketType.create({
      data: {
        eventId,
        name: "عادی",
        price: 80_000,
        capacity: 50,
        salesStartAt: new Date("2020-01-01T00:00:00.000Z"),
        salesEndAt: new Date("2030-01-01T00:00:00.000Z"),
        category: "GENERAL",
      },
      select: { id: true },
    })
  ).id;

  const result = await createOrder({
    eventId,
    sessionId,
    items: [{ ticketTypeId, quantity: 1 }],
    ...buyer,
  });
  created.push(result.order.id);
  orderCode = result.order.code;
  await markOrderPaid(result.order.id, { provider: "mock", authority: `c-${result.order.id}` });

  qrToken = (
    await db.ticket.findFirstOrThrow({
      where: { orderId: result.order.id },
      select: { qrToken: true },
    })
  ).qrToken;
});

afterEach(async () => {
  if (!sessionId) return;
  const { db } = await import("@/lib/server/db");
  await db.eventSession.update({
    where: { id: sessionId },
    data: { cancelled: false },
  });
  await db.event.update({ where: { id: eventId }, data: { status: "PUBLISHED" } });
});

afterAll(async () => {
  if (!eventId) return;
  const { db } = await import("@/lib/server/db");
  await restoreInventory(created);
  await db.checkIn.deleteMany({ where: { ticket: { orderId: { in: created } } } });
  await db.ticket.deleteMany({ where: { orderId: { in: created } } });
  await db.orderItem.deleteMany({ where: { orderId: { in: created } } });
  await db.order.deleteMany({ where: { id: { in: created } } });
  await db.ticketType.deleteMany({ where: { eventId } });
  await db.eventSession.deleteMany({ where: { eventId } });
  await db.event.deleteMany({ where: { id: eventId } });
  await db.venue.deleteMany({ where: { name: "سالن آزمون لغو" } });
  await db.attendee.deleteMany({ where: { phone: buyer.buyerPhone } });
});

const cancelSession = async () => {
  const { db } = await import("@/lib/server/db");
  await db.eventSession.update({
    where: { id: sessionId },
    data: { cancelled: true },
  });
};

describeApi("a ticket for a cancelled show", () => {
  it("reads as valid while the show is on", async () => {
    const { ticketsForOrderCode } = await import("@/lib/server/orders");
    const [ticket] = await ticketsForOrderCode(orderCode);

    expect(ticket.status).toBe("issued");
    expect(ticket.showCancelled).toBeUndefined();
  });

  it("is flagged the moment the سانس is cancelled", async () => {
    const { ticketsForOrderCode } = await import("@/lib/server/orders");
    await cancelSession();

    const [ticket] = await ticketsForOrderCode(orderCode);
    // Still `issued` — the refund is what voids it, and that has not happened.
    expect(ticket.status).toBe("issued");
    // …but the buyer must not be told the ticket is valid.
    expect(ticket.showCancelled).toBe(true);
  });

  it("is flagged when the whole event is cancelled", async () => {
    const { db } = await import("@/lib/server/db");
    const { ticketsForOrderCode } = await import("@/lib/server/orders");
    await db.event.update({
      where: { id: eventId },
      data: { status: "CANCELLED" },
    });

    const [ticket] = await ticketsForOrderCode(orderCode);
    expect(ticket.showCancelled).toBe(true);
  });

  it("is refused at the door", async () => {
    const { setCheckinByToken } = await import("@/lib/server/checkins");

    // Admitted while the show is on.
    const before = await setCheckinByToken(eventId, qrToken, true);
    expect(before.ok).toBe(true);
    await setCheckinByToken(eventId, qrToken, false);

    await cancelSession();

    const after = await setCheckinByToken(eventId, qrToken, true);
    expect(after.ok).toBe(false);
    if (!after.ok) {
      expect(after.reason).toBe("not-valid");
      // A reason, not "unknown code" — the ticket is real, the show is not.
      expect(after.message).toContain("لغو");
    }
  });

  it("reaches the buyer's own ticket list too, not just the order page", async () => {
    const { db } = await import("@/lib/server/db");
    const { listTicketsByUser } = await import("@/lib/server/orders");
    await cancelSession();

    // Attach the order to a user so it shows up in /me/tickets.
    const user = await db.user.findFirstOrThrow({ select: { id: true } });
    await db.order.updateMany({
      where: { id: { in: created } },
      data: { userId: user.id },
    });
    try {
      const mine = (await listTicketsByUser(user.id)).filter(
        (t) => t.eventId === eventId,
      );
      expect(mine.length).toBeGreaterThan(0);
      expect(mine[0].showCancelled).toBe(true);
    } finally {
      await db.order.updateMany({
        where: { id: { in: created } },
        data: { userId: null },
      });
    }
  });
});
