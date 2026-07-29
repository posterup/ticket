import { it, expect, beforeAll } from "vitest";

import { POST as CREATE_ORDER } from "@/app/api/orders/route";
import { GET as MY_TICKETS } from "@/app/api/me/tickets/route";
import { GET as MY_ORDERS } from "@/app/api/me/orders/route";
import type { IssuedTicket, Order } from "@/types";

import {
  data,
  describeApi,
  errorCode,
  parse,
  req,
  signInAs,
  signOut,
} from "./helpers";

const SEED_EVENT = "3f1a6c2e-0001-4a10-9b21-1a2b3c4d5e01";

/** A throwaway event with its own ticket types, so tests never fight the seed. */
async function makeEvent(opts: {
  price: number;
  capacity: number;
  published?: boolean;
}) {
  const { db } = await import("@/lib/server/db");
  const workspace = await db.workspace.findFirstOrThrow({ select: { id: true } });
  const venue = await db.venue.create({
    data: { name: "تالار", city: "تهران", address: "نشانی", capacity: 100 },
  });
  const event = await db.event.create({
    data: {
      workspaceId: workspace.id,
      venueId: venue.id,
      title: "رویداد سفارش",
      description: "",
      mode: "ONE_TIME",
      status: opts.published === false ? "DRAFT" : "PUBLISHED",
      sessions: {
        create: {
          startAt: new Date("2026-12-01T18:00:00.000Z"),
          endAt: new Date("2026-12-01T20:00:00.000Z"),
        },
      },
    },
  });
  const type = await db.ticketType.create({
    data: {
      eventId: event.id,
      name: "عادی",
      price: opts.price,
      capacity: opts.capacity,
      salesStartAt: new Date("2020-01-01T00:00:00.000Z"),
      salesEndAt: new Date("2030-01-01T00:00:00.000Z"),
      category: "GENERAL",
    },
  });
  return { eventId: event.id, ticketTypeId: type.id };
}

function orderBody(
  eventId: string,
  ticketTypeId: string,
  quantity = 1,
  extra: Record<string, unknown> = {},
) {
  return {
    eventId,
    items: [{ ticketTypeId, quantity }],
    buyerName: "سارا محمدی",
    buyerPhone: "09121234567",
    ...extra,
  };
}

beforeAll(async () => {
  if (process.env.DATABASE_URL) await signOut();
});

describeApi("POST /api/orders", () => {
  it("places a paid-pending order and holds the seats", async () => {
    const { eventId, ticketTypeId } = await makeEvent({ price: 150_000, capacity: 5 });
    const parsed = await parse<{ order: Order; requiresPayment: boolean }>(
      await CREATE_ORDER(req("POST", "/", orderBody(eventId, ticketTypeId, 2))),
    );
    expect(parsed.status).toBe(201);

    const { order, requiresPayment } = data(parsed);
    expect(order.status).toBe("pending-payment");
    expect(order.total).toBe(300_000);
    expect(requiresPayment).toBe(true);
    expect(order.code).toMatch(/^[A-Z0-9]{8}$/);

    const { db } = await import("@/lib/server/db");
    const type = await db.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId } });
    // Held, not sold — nothing is sold until the money arrives.
    expect(type.reserved).toBe(2);
    expect(type.sold).toBe(0);
  });

  it("settles a free order immediately and issues tickets", async () => {
    const { eventId, ticketTypeId } = await makeEvent({ price: 0, capacity: 5 });
    const { order, requiresPayment } = data(
      await parse<{ order: Order; requiresPayment: boolean }>(
        await CREATE_ORDER(req("POST", "/", orderBody(eventId, ticketTypeId, 3))),
      ),
    );
    // A free order must never reach a gateway that would reject a zero amount.
    expect(requiresPayment).toBe(false);
    expect(order.status).toBe("paid");

    const { db } = await import("@/lib/server/db");
    const type = await db.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId } });
    expect(type.sold).toBe(3);
    expect(type.reserved).toBe(0);
    expect(await db.ticket.count({ where: { orderId: order.id } })).toBe(3);
  });

  it("prices from the database, ignoring anything the client sends", async () => {
    const { eventId, ticketTypeId } = await makeEvent({ price: 150_000, capacity: 5 });
    const { order } = data(
      await parse<{ order: Order }>(
        await CREATE_ORDER(
          req(
            "POST",
            "/",
            orderBody(eventId, ticketTypeId, 1, { total: 1, subtotal: 1 }),
          ),
        ),
      ),
    );
    expect(order.total).toBe(150_000);
  });

  it("refuses to sell an unpublished event", async () => {
    const { eventId, ticketTypeId } = await makeEvent({
      price: 100_000,
      capacity: 5,
      published: false,
    });
    const parsed = await parse(
      await CREATE_ORDER(req("POST", "/", orderBody(eventId, ticketTypeId))),
    );
    expect(parsed.status).toBe(409);
    expect(errorCode(parsed)).toBe("SALES_CLOSED");
  });

  it("refuses a ticket type from another event", async () => {
    const a = await makeEvent({ price: 100_000, capacity: 5 });
    const b = await makeEvent({ price: 100_000, capacity: 5 });
    const parsed = await parse(
      await CREATE_ORDER(req("POST", "/", orderBody(a.eventId, b.ticketTypeId))),
    );
    expect(parsed.status).toBe(400);
  });

  it("404s an unknown event", async () => {
    const parsed = await parse(
      await CREATE_ORDER(req("POST", "/", orderBody("nope", "nope"))),
    );
    expect(parsed.status).toBe(404);
  });

  it("applies a valid discount code, server-side", async () => {
    const { eventId, ticketTypeId } = await makeEvent({ price: 1_000_000, capacity: 5 });
    const { order } = data(
      await parse<{ order: Order }>(
        await CREATE_ORDER(
          req("POST", "/", orderBody(eventId, ticketTypeId, 1, {
            discountCode: "welcome10",
          })),
        ),
      ),
    );
    expect(order.discountAmount).toBe(100_000);
    expect(order.total).toBe(900_000);
  });

  it("rejects an invalid discount code rather than ignoring it", async () => {
    const { eventId, ticketTypeId } = await makeEvent({ price: 100_000, capacity: 5 });
    const parsed = await parse(
      await CREATE_ORDER(
        req("POST", "/", orderBody(eventId, ticketTypeId, 1, { discountCode: "NOPE" })),
      ),
    );
    expect(parsed.status).toBe(400);
  });
});

describeApi("inventory", () => {
  it("refuses to oversell", async () => {
    const { eventId, ticketTypeId } = await makeEvent({ price: 100_000, capacity: 2 });
    const first = await parse(
      await CREATE_ORDER(req("POST", "/", orderBody(eventId, ticketTypeId, 2))),
    );
    expect(first.status).toBe(201);

    const second = await parse(
      await CREATE_ORDER(req("POST", "/", orderBody(eventId, ticketTypeId, 1))),
    );
    expect(second.status).toBe(409);
    expect(errorCode(second)).toBe("SOLD_OUT");
  });

  it("lets exactly one of N concurrent buyers take the last seat", async () => {
    // The whole reason seats are reserved with a conditional UPDATE rather than
    // a read followed by a write.
    const { eventId, ticketTypeId } = await makeEvent({ price: 100_000, capacity: 1 });

    const attempts = await Promise.all(
      Array.from({ length: 8 }, () =>
        CREATE_ORDER(req("POST", "/", orderBody(eventId, ticketTypeId, 1))).then(
          (res) => res.status,
        ),
      ),
    );

    expect(attempts.filter((s) => s === 201)).toHaveLength(1);
    expect(attempts.filter((s) => s === 409)).toHaveLength(7);

    const { db } = await import("@/lib/server/db");
    const type = await db.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId } });
    expect(type.sold + type.reserved).toBe(1);
  });

  it("releases seats when a hold expires", async () => {
    const { eventId, ticketTypeId } = await makeEvent({ price: 100_000, capacity: 1 });
    const { order } = data(
      await parse<{ order: Order }>(
        await CREATE_ORDER(req("POST", "/", orderBody(eventId, ticketTypeId, 1))),
      ),
    );

    const { db } = await import("@/lib/server/db");
    // Age the hold past its deadline.
    await db.order.update({
      where: { id: order.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    // The next buyer's attempt is what sweeps it, so the seat comes back.
    const next = await parse(
      await CREATE_ORDER(req("POST", "/", orderBody(eventId, ticketTypeId, 1))),
    );
    expect(next.status).toBe(201);

    const expired = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(expired.status).toBe("EXPIRED");
  });

  it("rolls back a partial hold when the second line is sold out", async () => {
    const plenty = await makeEvent({ price: 100_000, capacity: 10 });
    const { db } = await import("@/lib/server/db");
    const scarce = await db.ticketType.create({
      data: {
        eventId: plenty.eventId,
        name: "کمیاب",
        price: 100_000,
        capacity: 1,
        salesStartAt: new Date("2020-01-01T00:00:00.000Z"),
        salesEndAt: new Date("2030-01-01T00:00:00.000Z"),
        category: "VIP",
      },
    });

    const parsed = await parse(
      await CREATE_ORDER(
        req("POST", "/", {
          eventId: plenty.eventId,
          items: [
            { ticketTypeId: plenty.ticketTypeId, quantity: 2 },
            { ticketTypeId: scarce.id, quantity: 5 },
          ],
          buyerName: "سارا",
          buyerPhone: "09121234567",
        }),
      ),
    );
    expect(parsed.status).toBe(409);

    // The seats taken for the first line must not stay held.
    const first = await db.ticketType.findUniqueOrThrow({
      where: { id: plenty.ticketTypeId },
    });
    expect(first.reserved).toBe(0);
  });
});

describeApi("settlement", () => {
  it("is idempotent — a repeated callback issues no extra tickets", async () => {
    const { eventId, ticketTypeId } = await makeEvent({ price: 100_000, capacity: 5 });
    const { order } = data(
      await parse<{ order: Order }>(
        await CREATE_ORDER(req("POST", "/", orderBody(eventId, ticketTypeId, 2))),
      ),
    );

    const { markOrderPaid } = await import("@/lib/server/orders");
    await markOrderPaid(order.id, { provider: "mock", authority: `a-${order.id}` });
    const again = await markOrderPaid(order.id, { provider: "mock" });
    expect(again.status).toBe("paid");

    const { db } = await import("@/lib/server/db");
    expect(await db.ticket.count({ where: { orderId: order.id } })).toBe(2);
    const type = await db.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId } });
    expect(type.sold).toBe(2);
    expect(type.reserved).toBe(0);
  });

  it("turns the buyer into a CRM contact", async () => {
    const { eventId, ticketTypeId } = await makeEvent({ price: 100_000, capacity: 5 });
    const phone = "09129998877";
    const { order } = data(
      await parse<{ order: Order }>(
        await CREATE_ORDER(
          req("POST", "/", {
            ...orderBody(eventId, ticketTypeId, 1),
            buyerPhone: phone,
          }),
        ),
      ),
    );
    const { markOrderPaid } = await import("@/lib/server/orders");
    await markOrderPaid(order.id, { provider: "mock" });

    const { db } = await import("@/lib/server/db");
    const contact = await db.attendee.findFirst({ where: { phone } });
    expect(contact).not.toBeNull();
  });

  it("increments the discount's redemption count, finally", async () => {
    const { eventId, ticketTypeId } = await makeEvent({ price: 1_000_000, capacity: 5 });
    const { db } = await import("@/lib/server/db");
    const before = await db.discountCode.findFirstOrThrow({ where: { code: "WELCOME10" } });

    const { order } = data(
      await parse<{ order: Order }>(
        await CREATE_ORDER(
          req("POST", "/", orderBody(eventId, ticketTypeId, 1, {
            discountCode: "WELCOME10",
          })),
        ),
      ),
    );
    const { markOrderPaid } = await import("@/lib/server/orders");
    await markOrderPaid(order.id, { provider: "mock" });

    const after = await db.discountCode.findFirstOrThrow({ where: { code: "WELCOME10" } });
    expect(after.redemptions).toBe(before.redemptions + 1);
    expect(
      await db.discountRedemption.count({ where: { orderId: order.id } }),
    ).toBe(1);
  });
});

describeApi("/api/me", () => {
  it("refuses an anonymous caller", async () => {
    await signOut();
    expect((await parse(await MY_TICKETS())).status).toBe(401);
    expect((await parse(await MY_ORDERS())).status).toBe(401);
  });

  it("lists a buyer's own tickets, with QR tokens", async () => {
    const phone = "09126667788";
    await signInAs(phone);

    const { eventId, ticketTypeId } = await makeEvent({ price: 0, capacity: 5 });
    await CREATE_ORDER(
      req("POST", "/", { ...orderBody(eventId, ticketTypeId, 2), buyerPhone: phone }),
    );

    const tickets = data(await parse<IssuedTicket[]>(await MY_TICKETS()));
    expect(tickets.length).toBeGreaterThanOrEqual(2);
    for (const ticket of tickets) {
      expect(ticket.qrToken).toMatch(/^[\w-]{40,}$/);
      expect(ticket.eventTitle).toBeTruthy();
      expect(ticket.status).toBe("issued");
    }

    const orders = data(await parse<Order[]>(await MY_ORDERS()));
    expect(orders.length).toBeGreaterThanOrEqual(1);
    await signOut();
  });

  it("does not show tickets for an unpaid order", async () => {
    const phone = "09125554433";
    const userId = await signInAs(phone);

    // Reruns share the database, so start this buyer from nothing.
    const { db } = await import("@/lib/server/db");
    await db.order.deleteMany({ where: { userId } });

    const { eventId, ticketTypeId } = await makeEvent({ price: 100_000, capacity: 5 });
    await CREATE_ORDER(
      req("POST", "/", { ...orderBody(eventId, ticketTypeId, 1), buyerPhone: phone }),
    );

    expect(data(await parse<IssuedTicket[]>(await MY_TICKETS()))).toHaveLength(0);
    // The order itself is visible; only the tickets wait for payment.
    expect(data(await parse<Order[]>(await MY_ORDERS())).length).toBe(1);
    await signOut();
  });
});

describeApi("seeded event still sells", () => {
  it("accepts an order against the fixture concert", async () => {
    const { db } = await import("@/lib/server/db");
    // Pick one whose sales window is actually open — the suite also creates
    // types on this event with future windows, and those correctly refuse.
    const now = new Date();
    const type = await db.ticketType.findFirstOrThrow({
      where: {
        eventId: SEED_EVENT,
        salesStartAt: { lte: now },
        salesEndAt: { gte: now },
      },
    });
    const parsed = await parse<{ order: Order }>(
      await CREATE_ORDER(req("POST", "/", orderBody(SEED_EVENT, type.id, 1))),
    );
    expect(parsed.status).toBe(201);
  });
});
