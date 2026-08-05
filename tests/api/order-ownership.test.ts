/**
 * Whose order is it?
 *
 * An order is the one thing on this platform a *guest* owns. There is no
 * account behind most of them, so ownership is proved by the phone that placed
 * it or by a signed-in user id — and cancelling someone else's is not a
 * curiosity, it releases their seats to whoever asks next.
 *
 * The tenant sweep covered organiser-owned data. This is the other axis: one
 * buyer reaching for another buyer's order.
 */

import { it, expect, beforeAll, afterAll, afterEach } from "vitest";

import { POST as CANCEL } from "@/app/api/orders/[id]/cancel/route";
import { GET as BY_CODE } from "@/app/api/orders/by-code/[code]/route";

import {
  ctx,
  data,
  describeApi,
  dropTrackedEvents,
  parse,
  req,
  restoreInventory,
  signInAs,
  signOut,
  trackEvent,
  trackVenue,
} from "./helpers";

let eventId = "";
let ticketTypeId = "";
const created: string[] = [];

const BUYER = "09121117777";
const STRANGER = "09121118888";

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");
  const workspace = await db.workspace.findFirstOrThrow({ select: { id: true } });
  const venue = await db.venue.create({
    data: { name: "سالن آزمون مالکیت", city: "تهران", address: "-", capacity: 40 },
  });
  trackVenue(venue.id);
  const event = await db.event.create({
    data: {
      workspaceId: workspace.id,
      venueId: venue.id,
      title: "آزمون مالکیت سفارش",
      description: "",
      mode: "ONE_TIME",
      status: "PUBLISHED",
      sessions: {
        create: {
          startAt: new Date("2026-12-30T18:00:00Z"),
          endAt: new Date("2026-12-30T20:00:00Z"),
        },
      },
    },
    select: { id: true },
  });
  eventId = trackEvent(event.id);
  ticketTypeId = (
    await db.ticketType.create({
      data: {
        eventId,
        name: "عادی",
        price: 90_000,
        capacity: 40,
        salesStartAt: new Date("2020-01-01T00:00:00Z"),
        salesEndAt: new Date("2030-01-01T00:00:00Z"),
        category: "GENERAL",
      },
      select: { id: true },
    })
  ).id;
  await signOut();
});

afterEach(async () => {
  if (!created.length) return;
  const { db } = await import("@/lib/server/db");
  await restoreInventory(created);
  await db.orderItem.deleteMany({ where: { orderId: { in: created } } });
  await db.order.deleteMany({ where: { id: { in: created } } });
  created.length = 0;
  await db.attendee.deleteMany({ where: { phone: { in: [BUYER, STRANGER] } } });
});

afterAll(async () => {
  await signOut();
  await dropTrackedEvents();
});

async function place() {
  const { createOrder } = await import("@/lib/server/orders");
  const result = await createOrder({
    eventId,
    items: [{ ticketTypeId, quantity: 1 }],
    buyerName: "قربانی",
    buyerPhone: BUYER,
  });
  created.push(result.order.id);
  return result.order;
}

const statusOf = async (id: string) => {
  const { db } = await import("@/lib/server/db");
  return (
    await db.order.findUniqueOrThrow({ where: { id }, select: { status: true } })
  ).status;
};

describeApi("cancelling an order", () => {
  it("refuses an anonymous caller who proves nothing", async () => {
    const order = await place();
    const res = await CANCEL(req("POST", "/", {}), ctx({ id: order.id }));

    expect(res.status).not.toBe(200);
    // The real damage is not the status code — it is the seats.
    expect(await statusOf(order.id)).toBe("PENDING_PAYMENT");
  });

  it("refuses someone guessing a different phone", async () => {
    const order = await place();
    const res = await CANCEL(
      req("POST", "/", { phone: STRANGER }),
      ctx({ id: order.id }),
    );

    expect(res.status).not.toBe(200);
    expect(await statusOf(order.id)).toBe("PENDING_PAYMENT");
  });

  it("refuses a signed-in user who is not the buyer", async () => {
    const order = await place();
    await signInAs("09120000002");
    try {
      const res = await CANCEL(req("POST", "/", {}), ctx({ id: order.id }));
      expect(res.status).not.toBe(200);
      expect(await statusOf(order.id)).toBe("PENDING_PAYMENT");
    } finally {
      await signOut();
    }
  });

  it("lets the buyer cancel with the phone they ordered with", async () => {
    // In the body. It used to be a query parameter, which puts the number in
    // the access log, the browser history and the `Referer` header — for the
    // one value that stands in for a session on a guest order.
    const order = await place();
    const res = await CANCEL(
      req("POST", "/", { phone: BUYER }),
      ctx({ id: order.id }),
    );

    // A suite of refusals proves nothing if nobody can cancel at all.
    expect(res.status).toBe(200);
    expect(await statusOf(order.id)).toBe("CANCELLED");
  });
});

describeApi("reading an order by its code", () => {
  it("withholds the buyer's phone from someone who only has the code", async () => {
    const order = await place();
    const parsed = await parse<{ buyerPhone: string }>(
      await BY_CODE(req("GET", "/"), ctx({ code: order.code })),
    );

    // The code is a bearer secret — enough to see the tickets, not enough to
    // learn who bought them.
    expect(parsed.status).toBe(200);
    expect(data(parsed).buyerPhone).toBe("");
  });

  it("does not answer at all for a code that does not exist", async () => {
    const res = await BY_CODE(req("GET", "/"), ctx({ code: "NOSUCHCD" }));
    expect(res.status).toBe(404);
  });
});
