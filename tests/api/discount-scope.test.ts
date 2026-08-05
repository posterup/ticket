/**
 * Whose discount is it, and for which showing?
 *
 * Two holes, both found by reading the lookup rather than the rules.
 *
 * **Cross-workspace.** Codes are unique *per workspace* and the lookup was
 * `findFirst({ where: { code } })`. Combined with `eventId: null` meaning
 * "every event of the workspace", that made any workspace-wide code valid
 * against any event on the platform. Confirmed against the running database: a
 * 50% code issued by one organiser took ۲۵۰٬۰۰۰ to ۱۲۵٬۰۰۰ on another
 * organiser's ticket — funded by them, and burning the issuer's redemption
 * count to do it.
 *
 * **Session scope.** `DiscountCode.sessionId` is set by the dashboard, stored,
 * mapped, and displayed back as «یک سانس» — and never checked. A code meant for
 * a quiet Tuesday worked on the sold-out Friday.
 */

import { it, expect, beforeAll, afterAll, afterEach } from "vitest";

import {
  describeApi,
  restoreInventory,
  trackVenue,
} from "./helpers";

let eventId = "";
let sessionA = "";
let sessionB = "";
let ticketTypeId = "";
let ownWorkspaceId = "";
let otherWorkspaceId = "";
const codes: string[] = [];
const created: string[] = [];

const buyer = { buyerName: "آزمون تخفیف", buyerPhone: "09121112000" };

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");

  const workspace = await db.workspace.findFirstOrThrow({ select: { id: true } });
  ownWorkspaceId = workspace.id;
  otherWorkspaceId =
    (
      await db.workspace.findFirst({
        where: { id: { not: workspace.id } },
        select: { id: true },
      })
    )?.id ?? "";

  const venue = await db.venue.create({
    data: { name: "سالن آزمون تخفیف", city: "تهران", address: "-", capacity: 80 },
  });
  trackVenue(venue.id);
  const event = await db.event.create({
    data: {
      workspaceId: ownWorkspaceId,
      venueId: venue.id,
      title: "آزمون دامنهٔ تخفیف",
      description: "",
      mode: "MULTI_SESSION",
      status: "PUBLISHED",
      sessions: {
        create: [
          {
            startAt: new Date("2026-12-11T18:00:00.000Z"),
            endAt: new Date("2026-12-11T20:00:00.000Z"),
          },
          {
            startAt: new Date("2026-12-12T18:00:00.000Z"),
            endAt: new Date("2026-12-12T20:00:00.000Z"),
          },
        ],
      },
    },
    select: { id: true, sessions: { orderBy: { startAt: "asc" }, select: { id: true } } },
  });
  eventId = event.id;
  sessionA = event.sessions[0].id;
  sessionB = event.sessions[1].id;

  ticketTypeId = (
    await db.ticketType.create({
      data: {
        eventId,
        name: "عادی",
        price: 100_000,
        capacity: 100,
        salesStartAt: new Date("2020-01-01T00:00:00.000Z"),
        salesEndAt: new Date("2030-01-01T00:00:00.000Z"),
        category: "GENERAL",
      },
      select: { id: true },
    })
  ).id;
});

async function makeCode(opts: {
  workspaceId: string;
  eventId?: string | null;
  sessionId?: string | null;
  code: string;
}) {
  const { db } = await import("@/lib/server/db");
  const row = await db.discountCode.create({
    data: {
      workspaceId: opts.workspaceId,
      eventId: opts.eventId ?? null,
      sessionId: opts.sessionId ?? null,
      code: opts.code,
      kind: "PERCENT",
      value: 50,
      active: true,
    },
    select: { id: true },
  });
  codes.push(row.id);
  return opts.code;
}

afterEach(async () => {
  const { db } = await import("@/lib/server/db");
  if (created.length) {
    await restoreInventory(created);
    await db.ticket.deleteMany({ where: { orderId: { in: created } } });
    await db.orderItem.deleteMany({ where: { orderId: { in: created } } });
    await db.order.deleteMany({ where: { id: { in: created } } });
    created.length = 0;
  }
  if (codes.length) {
    await db.discountRedemption.deleteMany({
      where: { discountCodeId: { in: codes } },
    });
    await db.discountCode.deleteMany({ where: { id: { in: codes } } });
    codes.length = 0;
  }
  await db.attendee.deleteMany({ where: { phone: buyer.buyerPhone } });
});

afterAll(async () => {
  if (!eventId) return;
  const { db } = await import("@/lib/server/db");
  await db.ticketType.deleteMany({ where: { eventId } });
  await db.eventSession.deleteMany({ where: { eventId } });
  await db.event.deleteMany({ where: { id: eventId } });
  await db.venue.deleteMany({ where: { name: "سالن آزمون تخفیف" } });
});

async function order(code: string | undefined, sessionId?: string) {
  const { createOrder } = await import("@/lib/server/orders");
  const result = await createOrder({
    eventId,
    sessionId,
    items: [{ ticketTypeId, quantity: 1 }],
    discountCode: code,
    ...buyer,
  });
  created.push(result.order.id);
  return result.order;
}

describeApi("discount scope", () => {
  it("refuses a workspace-wide code from another workspace", async () => {
    if (!otherWorkspaceId) return;
    const code = await makeCode({
      workspaceId: otherWorkspaceId,
      eventId: null,
      code: "OTHER-WS-WIDE",
    });

    // The `eventId: null` short-circuit is what made this reachable: it means
    // "every event of *my* workspace", not every event anywhere.
    await expect(order(code)).rejects.toThrow(/معتبر نیست/);
  });

  it("still honours a workspace-wide code from the owning workspace", async () => {
    const code = await makeCode({
      workspaceId: ownWorkspaceId,
      eventId: null,
      code: "OWN-WS-WIDE",
    });

    const placed = await order(code);
    expect(placed.discountAmount).toBe(50_000);
    expect(placed.total).toBe(50_000);
  });

  it("refuses a code pinned to a different سانس", async () => {
    const code = await makeCode({
      workspaceId: ownWorkspaceId,
      eventId,
      sessionId: sessionA,
      code: "SESSION-A-ONLY",
    });

    await expect(order(code, sessionB)).rejects.toThrow(/این سانس/);
  });

  it("honours it on the سانس it was made for", async () => {
    const code = await makeCode({
      workspaceId: ownWorkspaceId,
      eventId,
      sessionId: sessionA,
      code: "SESSION-A-OK",
    });

    const placed = await order(code, sessionA);
    expect(placed.discountAmount).toBe(50_000);
  });

  it("refuses a سانس-scoped code on an order that names no سانس", async () => {
    const code = await makeCode({
      workspaceId: ownWorkspaceId,
      eventId,
      sessionId: sessionA,
      code: "SESSION-A-STRICT",
    });

    // The organiser said "this showing". An order that names none is not it.
    await expect(order(code, undefined)).rejects.toThrow(/این سانس/);
  });

  it("leaves an unscoped code working on every سانس", async () => {
    const code = await makeCode({
      workspaceId: ownWorkspaceId,
      eventId,
      sessionId: null,
      code: "ANY-SESSION",
    });

    expect((await order(code, sessionA)).discountAmount).toBe(50_000);
    expect((await order(code, sessionB)).discountAmount).toBe(50_000);
  });

  it("previews exactly what checkout will do", async () => {
    const { validateDiscount } = await import("@/lib/server/discounts");
    const code = await makeCode({
      workspaceId: ownWorkspaceId,
      eventId,
      sessionId: sessionA,
      code: "PREVIEW-MATCH",
    });

    // Preview and submit must agree, or the buyer is told «اعمال شد» and
    // refused at the moment they pay.
    expect((await validateDiscount(code, eventId, 100_000, sessionA)).ok).toBe(
      true,
    );
    expect((await validateDiscount(code, eventId, 100_000, sessionB)).ok).toBe(
      false,
    );
  });

  it("previews a foreign workspace's code as invalid", async () => {
    if (!otherWorkspaceId) return;
    const { validateDiscount } = await import("@/lib/server/discounts");
    const code = await makeCode({
      workspaceId: otherWorkspaceId,
      eventId: null,
      code: "OTHER-WS-PREVIEW",
    });

    expect((await validateDiscount(code, eventId, 100_000)).ok).toBe(false);
  });
});
