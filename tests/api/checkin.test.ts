import { it, expect, beforeAll } from "vitest";

import { POST as CHECKIN } from "@/app/api/checkin/route";
import { POST as CREATE_ORDER } from "@/app/api/orders/route";
import type { Order } from "@/types";

import {
  data,
  describeApi,
  errorCode,
  parse,
  req,
  signInAsOwner,
  signOut,
} from "./helpers";

/**
 * A published free event with one issued ticket per seat — free orders settle
 * immediately, so this is the shortest route to a real scannable ticket.
 */
async function eventWithTickets(quantity = 2) {
  const { db } = await import("@/lib/server/db");
  const workspace = await db.workspace.findFirstOrThrow({
    where: { slug: "ava-events" },
    select: { id: true },
  });
  const venue = await db.venue.create({
    data: { name: "تالار", city: "تهران", address: "نشانی", capacity: 50 },
  });
  const event = await db.event.create({
    data: {
      workspaceId: workspace.id,
      venueId: venue.id,
      title: "رویداد پذیرش",
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
    include: { sessions: true },
  });
  const type = await db.ticketType.create({
    data: {
      eventId: event.id,
      name: "عمومی",
      price: 0,
      capacity: 20,
      salesStartAt: new Date("2020-01-01T00:00:00.000Z"),
      salesEndAt: new Date("2030-01-01T00:00:00.000Z"),
      category: "GENERAL",
    },
  });

  await signOut();
  const { order } = data(
    await parse<{ order: Order }>(
      await CREATE_ORDER(
        req("POST", "/", {
          eventId: event.id,
          sessionId: event.sessions[0].id,
          items: [{ ticketTypeId: type.id, quantity }],
          buyerName: "سارا محمدی",
          buyerPhone: "09121234567",
        }),
      ),
    ),
  );
  await signInAsOwner();

  const tickets = await db.ticket.findMany({ where: { orderId: order.id } });
  return { eventId: event.id, tickets };
}

beforeAll(async () => {
  if (process.env.DATABASE_URL) await signInAsOwner();
});

describeApi("POST /api/checkin", () => {
  it("admits a ticket by its scanned token", async () => {
    const { eventId, tickets } = await eventWithTickets(1);
    const parsed = await parse<{ holderName: string; checked: boolean }>(
      await CHECKIN(
        req("POST", "/", { eventId, qrToken: tickets[0].qrToken, checked: true }),
      ),
    );
    expect(parsed.status).toBe(200);
    expect(data(parsed).checked).toBe(true);
    expect(data(parsed).holderName).toBe("سارا محمدی");

    const { db } = await import("@/lib/server/db");
    const ticket = await db.ticket.findUniqueOrThrow({
      where: { id: tickets[0].id },
      include: { checkIn: true },
    });
    // Both the row and the ticket's own status move, so the door list and the
    // holder's own view agree.
    expect(ticket.checkIn).not.toBeNull();
    expect(ticket.status).toBe("CHECKED_IN");
  });

  it("refuses a second scan of the same ticket", async () => {
    const { eventId, tickets } = await eventWithTickets(1);
    const body = { eventId, qrToken: tickets[0].qrToken, checked: true };

    expect((await parse(await CHECKIN(req("POST", "/", body)))).status).toBe(200);

    // The unique constraint on ticketId is the real guard; this is it
    // surfacing as a conflict the door can act on.
    const again = await parse(await CHECKIN(req("POST", "/", body)));
    expect(again.status).toBe(409);
    expect(errorCode(again)).toBe("CONFLICT");
  });

  it("can un-admit, so a mis-scan is recoverable", async () => {
    const { eventId, tickets } = await eventWithTickets(1);
    const token = tickets[0].qrToken;
    await CHECKIN(req("POST", "/", { eventId, qrToken: token, checked: true }));

    const undone = await parse<{ checked: boolean }>(
      await CHECKIN(req("POST", "/", { eventId, qrToken: token, checked: false })),
    );
    expect(data(undone).checked).toBe(false);

    const { db } = await import("@/lib/server/db");
    const ticket = await db.ticket.findUniqueOrThrow({
      where: { id: tickets[0].id },
      include: { checkIn: true },
    });
    expect(ticket.checkIn).toBeNull();
    expect(ticket.status).toBe("ISSUED");

    // And it can be admitted again afterwards.
    expect(
      (await parse(await CHECKIN(req("POST", "/", { eventId, qrToken: token, checked: true }))))
        .status,
    ).toBe(200);
  });

  it("refuses a ticket belonging to another event", async () => {
    const a = await eventWithTickets(1);
    const b = await eventWithTickets(1);

    // Scanning at the wrong door must fail, not quietly admit.
    const parsed = await parse(
      await CHECKIN(
        req("POST", "/", {
          eventId: a.eventId,
          qrToken: b.tickets[0].qrToken,
          checked: true,
        }),
      ),
    );
    expect(parsed.status).toBe(409);
  });

  it("404s an unknown token", async () => {
    const { eventId } = await eventWithTickets(1);
    const parsed = await parse(
      await CHECKIN(req("POST", "/", { eventId, qrToken: "not-a-token", checked: true })),
    );
    expect(parsed.status).toBe(404);
    expect(errorCode(parsed)).toBe("NOT_FOUND");
  });

  it("refuses a cancelled ticket", async () => {
    const { eventId, tickets } = await eventWithTickets(1);
    const { db } = await import("@/lib/server/db");
    await db.ticket.update({
      where: { id: tickets[0].id },
      data: { status: "CANCELLED" },
    });

    const parsed = await parse(
      await CHECKIN(
        req("POST", "/", { eventId, qrToken: tickets[0].qrToken, checked: true }),
      ),
    );
    expect(parsed.status).toBe(409);
  });

  it("refuses an anonymous scanner", async () => {
    const { eventId, tickets } = await eventWithTickets(1);
    await signOut();

    const parsed = await parse(
      await CHECKIN(
        req("POST", "/", { eventId, qrToken: tickets[0].qrToken, checked: true }),
      ),
    );
    expect(parsed.status).toBe(401);
    await signInAsOwner();
  });

  it("requires an eventId, so a token alone cannot admit anywhere", async () => {
    const { tickets } = await eventWithTickets(1);
    const parsed = await parse(
      await CHECKIN(req("POST", "/", { qrToken: tickets[0].qrToken, checked: true })),
    );
    expect(parsed.status).toBe(400);
    expect(errorCode(parsed)).toBe("INVALID_BODY");
  });
});

describeApi("door list", () => {
  it("lists issued tickets and reflects who has been admitted", async () => {
    const { eventId, tickets } = await eventWithTickets(3);
    const { listHolders, listCheckedTicketIds } = await import(
      "@/lib/server/checkins"
    );

    const holders = await listHolders(eventId, new Map());
    expect(holders).toHaveLength(3);
    // The printed code is the order's tracking code plus a sequence.
    expect(holders[0].code).toMatch(/^[A-Z0-9]{8}-1$/);
    expect(holders.map((h) => h.qrToken)).toContain(tickets[0].qrToken);

    expect(await listCheckedTicketIds(eventId)).toHaveLength(0);
    await CHECKIN(
      req("POST", "/", { eventId, qrToken: tickets[0].qrToken, checked: true }),
    );
    expect(await listCheckedTicketIds(eventId)).toEqual([tickets[0].id]);
  });

  it("omits tickets from unpaid orders", async () => {
    // An abandoned checkout must not put anyone on a guest list.
    const { db } = await import("@/lib/server/db");
    const { eventId } = await eventWithTickets(1);
    const order = await db.order.findFirstOrThrow({ where: { eventId } });
    await db.order.update({
      where: { id: order.id },
      data: { status: "PENDING_PAYMENT" },
    });

    const { listHolders } = await import("@/lib/server/checkins");
    expect(await listHolders(eventId, new Map())).toHaveLength(0);
  });
});
