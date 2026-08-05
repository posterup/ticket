/**
 * Telling ticket holders a show is off.
 *
 * The two failures that matter are opposite and both bad: saying nothing when a
 * show is cancelled, and saying it twice to a thousand people because a form
 * was submitted again. Both are covered here.
 *
 * The gateway is stubbed rather than configured — the point is *who would be
 * messaged and how often*, which is exactly what cannot be checked against a
 * real operator.
 */

import { it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";

import {
  describeApi,
  dropTrackedEvents,
  trackEvent,
  trackVenue,
} from "./helpers";

let eventId = "";
let sessionId = "";
let otherSessionId = "";

const sent: { phones: string[]; text: string }[] = [];

vi.mock("@/lib/server/sms", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/sms")>();
  return {
    ...actual,
    smsGateway: () => ({
      provider: "stub",
      configured: true,
      sendBulk: async (phones: string[], text: string) => {
        sent.push({ phones, text });
        return { ok: true, sent: phones.length };
      },
      sendVerify: async () => ({ ok: true, sent: 1 }),
    }),
  };
});

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");
  const { createOrder, markOrderPaid } = await import("@/lib/server/orders");

  /**
   * Its own event, with its own paid order.
   *
   * This used to scavenge `findFirst({ status: PAID })` out of the database —
   * and a clean seed contains **no orders at all**. It only ever worked on rows
   * leaked by the order, payment and check-in suites, so it passed for the
   * wrong reason and broke the moment those suites started cleaning up.
   */
  const workspace = await db.workspace.findFirstOrThrow({ select: { id: true } });
  const venue = await db.venue.create({
    data: { name: "سالن آزمون لغو-اعلان", city: "تهران", address: "-", capacity: 40 },
  });
  trackVenue(venue.id);
  const event = await db.event.create({
    data: {
      workspaceId: workspace.id,
      venueId: venue.id,
      title: "آزمون اعلان لغو",
      description: "",
      mode: "MULTI_SESSION",
      status: "PUBLISHED",
      sessions: {
        create: [
          { startAt: new Date("2026-12-20T18:00:00Z"), endAt: new Date("2026-12-20T20:00:00Z") },
          { startAt: new Date("2026-12-21T18:00:00Z"), endAt: new Date("2026-12-21T20:00:00Z") },
        ],
      },
    },
    select: { id: true, sessions: { orderBy: { startAt: "asc" }, select: { id: true } } },
  });
  eventId = trackEvent(event.id);
  sessionId = event.sessions[0].id;
  otherSessionId = event.sessions[1].id;

  const type = await db.ticketType.create({
    data: {
      eventId,
      name: "عادی",
      price: 70_000,
      capacity: 50,
      salesStartAt: new Date("2020-01-01T00:00:00Z"),
      salesEndAt: new Date("2030-01-01T00:00:00Z"),
      category: "GENERAL",
    },
    select: { id: true },
  });

  // Two buyers, one of them with two tickets, so "one message per person"
  // means something.
  for (const [name, phone, qty] of [
    ["خریدار یک", "09121119100", 2],
    ["خریدار دو", "09121119101", 1],
  ] as const) {
    const placed = await createOrder({
      eventId,
      sessionId,
      items: [{ ticketTypeId: type.id, quantity: qty }],
      buyerName: name,
      buyerPhone: phone,
    });
    await markOrderPaid(placed.order.id, {
      provider: "mock",
      authority: `cn-${placed.order.id}`,
    });
  }

  // Settlement sends its own confirmations, and the stub records everything.
  // `afterEach` clears the log, but it has not run yet.
  await new Promise((r) => setTimeout(r, 80));
  sent.length = 0;
});

afterEach(async () => {
  sent.length = 0;
  if (!sessionId) return;
  const { db } = await import("@/lib/server/db");
  await db.eventSession.update({
    where: { id: sessionId },
    data: { cancelled: false },
  });
  if (otherSessionId) {
    await db.eventSession.update({
      where: { id: otherSessionId },
      data: { cancelled: false },
    });
  }
});

/** Give the un-awaited notifier a turn to run. */
afterAll(dropTrackedEvents);

const settle = () => new Promise((r) => setTimeout(r, 60));

describeApi("cancellation notices", () => {
  it("messages ticket holders when a سانس is cancelled", async () => {
    const { updateSession } = await import("@/lib/server/events");
    await updateSession(eventId, sessionId, { cancelled: true });
    await settle();

    expect(sent).toHaveLength(1);
    expect(sent[0].phones.length).toBeGreaterThan(0);
    expect(sent[0].text).toContain("لغو سانس");
    // What to do next, not just what happened.
    expect(sent[0].text).toContain("بازگردانده");
  });

  it("does not message again when an already-cancelled سانس is re-saved", async () => {
    const { updateSession } = await import("@/lib/server/events");
    await updateSession(eventId, sessionId, { cancelled: true });
    await settle();
    expect(sent).toHaveLength(1);

    // Exactly what a dashboard form does on a second submit.
    await updateSession(eventId, sessionId, { cancelled: true });
    await updateSession(eventId, sessionId, { availability: "available" });
    await settle();

    expect(sent).toHaveLength(1);
  });

  it("says nothing when a سانس is un-cancelled", async () => {
    const { updateSession } = await import("@/lib/server/events");
    await updateSession(eventId, sessionId, { cancelled: true });
    await settle();
    sent.length = 0;

    await updateSession(eventId, sessionId, { cancelled: false });
    await settle();
    expect(sent).toHaveLength(0);
  });

  it("messages each buyer once, however many tickets they hold", async () => {
    const { db } = await import("@/lib/server/db");
    const { updateSession } = await import("@/lib/server/events");

    const orders = await db.order.findMany({
      where: { eventId, sessionId, status: "PAID" },
      select: { buyerPhone: true },
    });
    const distinct = new Set(orders.map((o) => o.buyerPhone)).size;

    await updateSession(eventId, sessionId, { cancelled: true });
    await settle();

    expect(sent[0].phones).toHaveLength(distinct);
    expect(new Set(sent[0].phones).size).toBe(distinct);
  });

  it("only reaches the cancelled سانس, not the whole event", async () => {
    if (!otherSessionId) return;
    const { db } = await import("@/lib/server/db");
    const { updateSession } = await import("@/lib/server/events");

    const wholeEvent = await db.order.count({
      where: { eventId, status: "PAID" },
    });
    const thisSession = await db.order.count({
      where: { eventId, sessionId, status: "PAID" },
    });

    await updateSession(eventId, sessionId, { cancelled: true });
    await settle();

    expect(sent[0].phones.length).toBeLessThanOrEqual(thisSession);
    if (wholeEvent > thisSession) {
      expect(sent[0].phones.length).toBeLessThan(wholeEvent);
    }
  });

  it("still reaches buyers whose order names no سانس, on a one-off event", async () => {
    const { db } = await import("@/lib/server/db");
    const { cancellationReach } = await import(
      "@/lib/server/notifications/show-cancelled"
    );

    // A single-session event whose paid orders carry no sessionId — the shape
    // that checkout produces for a one-off show, and the one a naive
    // `where: { sessionId }` drops entirely.
    const orphan = await db.order.findFirst({
      where: { status: "PAID", sessionId: null },
      select: { eventId: true },
    });
    if (!orphan) return;

    const sessions = await db.eventSession.findMany({
      where: { eventId: orphan.eventId },
      select: { id: true },
    });
    if (sessions.length !== 1) return;

    const reach = await cancellationReach(orphan.eventId, sessions[0].id);
    expect(reach.people).toBeGreaterThan(0);
  });

  it("reports the reach before an organiser commits to it", async () => {
    const { cancellationReach } = await import(
      "@/lib/server/notifications/show-cancelled"
    );
    const reach = await cancellationReach(eventId, sessionId);

    expect(reach.people).toBeGreaterThan(0);
    // Tickets can exceed people; it can never be the other way round.
    expect(reach.tickets).toBeGreaterThanOrEqual(reach.people);
  });
});
