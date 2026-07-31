/**
 * You cannot buy what you are not allowed to see.
 *
 * «مخاطبان هدف» restricts an event to a CRM segment: the organiser picks tags,
 * and only contacts carrying one of them may have it. `resolveEventGrant`
 * enforces that on **reading** — `listEvents` filters it out and the event page
 * refuses — and `createOrder` did not enforce it at all. It selected `status`,
 * `workspaceId` and `requiresApproval` off the event and never looked at
 * `visibility`, so anyone holding an `eventId` and a `ticketTypeId` could post
 * an order against a targeted event and be sold a ticket.
 *
 * That is the whole control failing open. An organiser running a members-only
 * evening, or a corporate event priced for one company, had it enforced
 * everywhere except the one place that takes money.
 *
 * Matched on the **buyer's phone**, not the session, exactly as the approval
 * gate directly above it in `createOrder` is. Checkout is open to guests by
 * design, and requiring an account here would close a door the platform
 * deliberately leaves open for every other kind of event.
 */

import { it, expect, beforeAll, afterAll, afterEach } from "vitest";

import { POST as CREATE_ORDER } from "@/app/api/orders/route";
import type { Order } from "@/types";

import { describeApi, data, errorCode, parse, req } from "./helpers";

let eventId = "";
let ticketTypeId = "";
let workspaceId = "";
let tagId = "";
let attendeeId = "";

const MEMBER = "09127776655"; // carries the audience tag
const STRANGER = "09123334455"; // does not
const TAG = "عضو-انجمن-آزمون";

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");

  const base = await db.event.findFirst({
    where: { status: "PUBLISHED" },
    select: { workspaceId: true, venueId: true },
  });
  if (!base) return;
  workspaceId = base.workspaceId;

  const now = Date.now();
  const event = await db.event.create({
    data: {
      workspaceId,
      venueId: base.venueId,
      title: "رویداد مخاطبان هدف (آزمون)",
      description: "آزمون دروازهٔ مخاطب",
      status: "PUBLISHED",
      mode: "ONE_TIME",
      visibility: "AUDIENCE",
      audienceTags: [TAG],
      ticketTypes: {
        create: {
          name: "عادی",
          price: 250_000,
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

  // One contact in the workspace who actually carries the tag.
  const tag = await db.attendeeTag.create({ data: { workspaceId, label: TAG } });
  tagId = tag.id;
  const attendee = await db.attendee.create({
    data: {
      workspaceId,
      fullName: "عضو آزمون",
      phone: MEMBER,
      tags: { create: { tagId } },
    },
    select: { id: true },
  });
  attendeeId = attendee.id;
});

afterEach(async () => {
  if (!process.env.DATABASE_URL || !eventId) return;
  const { db } = await import("@/lib/server/db");
  const orders = await db.order.findMany({ where: { eventId }, select: { id: true } });
  const ids = orders.map((o) => o.id);
  await db.ticket.deleteMany({ where: { orderId: { in: ids } } });
  await db.orderItem.deleteMany({ where: { orderId: { in: ids } } });
  await db.order.deleteMany({ where: { id: { in: ids } } });
  await db.ticketType.updateMany({
    where: { eventId },
    data: { sold: 0, reserved: 0 },
  });
});

afterAll(async () => {
  if (!process.env.DATABASE_URL || !eventId) return;
  const { db } = await import("@/lib/server/db");
  await db.ticketType.deleteMany({ where: { eventId } });
  await db.event.deleteMany({ where: { id: eventId } });
  if (attendeeId) {
    await db.attendeeTagLink.deleteMany({ where: { attendeeId } });
    await db.attendee.deleteMany({ where: { id: attendeeId } });
  }
  if (tagId) await db.attendeeTag.deleteMany({ where: { id: tagId } });
});

function order(phone: string) {
  return CREATE_ORDER(
    req("POST", "/api/orders", {
      eventId,
      items: [{ ticketTypeId, quantity: 1 }],
      buyerName: "خریدار",
      buyerPhone: phone,
    }),
  );
}

describeApi("an event restricted to «مخاطبان هدف»", () => {
  it("refuses a buyer who is not in the segment", async () => {
    // The listing already hides this event; the hole was that knowing the two
    // ids was enough to buy anyway.
    const parsed = await parse(await order(STRANGER));
    expect(parsed.status).toBe(403);
    expect(errorCode(parsed)).toBe("FORBIDDEN");
  });

  it("lets a tagged contact buy", async () => {
    const parsed = await parse<{ order: Order }>(await order(MEMBER));
    expect(parsed.status).toBe(201);
    expect(data(parsed).order.total).toBe(250_000);
  });

  it("matches the segment across mobile formats", async () => {
    // Same human, +98 form. Normalisation must not lock a member out.
    const parsed = await parse<{ order: Order }>(await order("+989127776655"));
    expect(parsed.status).toBe(201);
  });

  it("does not accept a tag from another workspace", async () => {
    const { db } = await import("@/lib/server/db");
    const other = await db.workspace.findFirst({
      where: { id: { not: workspaceId } },
      select: { id: true },
    });
    if (!other) return;

    // Same label, different organisation. Audience targeting is per-workspace:
    // one organiser's «عضو» must not admit another's.
    const foreignTag = await db.attendeeTag.create({
      data: { workspaceId: other.id, label: TAG },
    });
    const foreign = await db.attendee.create({
      data: {
        workspaceId: other.id,
        fullName: "عضو بیگانه",
        phone: STRANGER,
        tags: { create: { tagId: foreignTag.id } },
      },
      select: { id: true },
    });

    try {
      expect(errorCode(await parse(await order(STRANGER)))).toBe("FORBIDDEN");
    } finally {
      await db.attendeeTagLink.deleteMany({ where: { attendeeId: foreign.id } });
      await db.attendee.deleteMany({ where: { id: foreign.id } });
      await db.attendeeTag.deleteMany({ where: { id: foreignTag.id } });
    }
  });
});
