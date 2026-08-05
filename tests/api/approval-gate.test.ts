import { it, expect, beforeAll, afterAll, afterEach } from "vitest";

import { POST as CREATE_ORDER } from "@/app/api/orders/route";
import { POST as REQUEST_JOIN } from "@/app/api/events/[id]/registrations/route";
import type { Order } from "@/types";

import { ctx, data, describeApi, errorCode, parse, req } from "./helpers";

let eventId = "";
let ticketTypeId = "";
const PHONE = "09129998877";

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");

  // An approval-gated event of our own, so the seeded fixtures stay untouched.
  const base = await db.event.findFirst({
    where: { status: "PUBLISHED" },
    select: { workspaceId: true, venueId: true },
  });
  if (!base) return;

  const now = Date.now();
  const event = await db.event.create({
    data: {
      workspaceId: base.workspaceId,
      venueId: base.venueId,
      title: "رویداد با تأیید میزبان",
      description: "آزمون دروازه تأیید",
      status: "PUBLISHED",
      mode: "ONE_TIME",
      requiresApproval: true,
      ticketTypes: {
        create: {
          name: "عادی",
          price: 100_000,
          capacity: 50,
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
  await db.eventRegistration.deleteMany({ where: { eventId } });
  const orders = await db.order.findMany({ where: { eventId }, select: { id: true } });
  const ids = orders.map((o) => o.id);
  await db.ticket.deleteMany({ where: { orderId: { in: ids } } });
  await db.orderItem.deleteMany({ where: { orderId: { in: ids } } });
  await db.order.deleteMany({ where: { id: { in: ids } } });
});

/** The fixture event is ours, so it goes when the suite does. */
afterAll(async () => {
  if (!process.env.DATABASE_URL || !eventId) return;
  const { db } = await import("@/lib/server/db");
  await db.ticketType.deleteMany({ where: { eventId } });
  await db.event.deleteMany({ where: { id: eventId } });
});

function order(phone = PHONE) {
  return CREATE_ORDER(
    req("POST", "/api/orders", {
      eventId,
      items: [{ ticketTypeId, quantity: 1 }],
      buyerName: "متقاضی",
      buyerPhone: phone,
    }),
  );
}

describeApi("approval-gated events", () => {
  it("refuses a direct order from someone who never asked", async () => {
    // The public page routes these to a join request, but the gate has to hold
    // against a crafted POST or the organiser's decision is decorative.
    const parsed = await parse(await order());
    expect(parsed.status).toBe(403);
    expect(errorCode(parsed)).toBe("FORBIDDEN");
  });

  it("still refuses while the request is only pending", async () => {
    await REQUEST_JOIN(
      req("POST", "/", { name: "متقاضی", phone: PHONE, tickets: 1 }),
      ctx({ id: eventId }),
    );
    const parsed = await parse(await order());
    expect(errorCode(parsed)).toBe("FORBIDDEN");
  });

  it("lets an accepted attendee buy", async () => {
    const { db } = await import("@/lib/server/db");
    await REQUEST_JOIN(
      req("POST", "/", { name: "متقاضی", phone: PHONE, tickets: 1 }),
      ctx({ id: eventId }),
    );
    await db.eventRegistration.updateMany({
      where: { eventId, phone: PHONE },
      data: { status: "ACCEPTED" },
    });

    const parsed = await parse<{ order: Order }>(await order());
    expect(parsed.status).toBe(201);
    expect(data(parsed).order.total).toBe(100_000);
  });

  it("does not let one acceptance cover a different phone", async () => {
    const { db } = await import("@/lib/server/db");
    await REQUEST_JOIN(
      req("POST", "/", { name: "متقاضی", phone: PHONE, tickets: 1 }),
      ctx({ id: eventId }),
    );
    await db.eventRegistration.updateMany({
      where: { eventId, phone: PHONE },
      data: { status: "ACCEPTED" },
    });

    const parsed = await parse(await order("09121112233"));
    expect(errorCode(parsed)).toBe("FORBIDDEN");
  });

  it("matches an acceptance across mobile formats", async () => {
    const { db } = await import("@/lib/server/db");
    await REQUEST_JOIN(
      req("POST", "/", { name: "متقاضی", phone: PHONE, tickets: 1 }),
      ctx({ id: eventId }),
    );
    await db.eventRegistration.updateMany({
      where: { eventId, phone: PHONE },
      data: { status: "ACCEPTED" },
    });

    // Same human, +98 form. Normalisation must not lock them out.
    const parsed = await parse<{ order: Order }>(await order("+989129998877"));
    expect(parsed.status).toBe(201);
  });
});
