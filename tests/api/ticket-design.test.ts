/**
 * «قالب بلیت» — the organiser's ticket design.
 *
 * The designer existed on the dashboard with no persistence whatsoever: its
 * save button set a local boolean and rendered «ذخیره شد» over a template that
 * was dropped on reload and never reached a buyer. These tests are the
 * round trip that was missing — saved by the organiser, read back on the
 * buyer's issued ticket.
 */

import { it, expect, beforeAll, afterAll, afterEach } from "vitest";

import {
  describeApi,
  dropTrackedEvents,
  trackEvent,
  trackVenue,
} from "./helpers";

let eventId = "";
let original: unknown = null;

const design = {
  accent: "#1a7f5a",
  surface: "dark" as const,
  bgColor: "#101820",
  showCategory: true,
  showDate: true,
  showVenue: false,
  note: "درِ شمالی، از ساعت ۱۸",
};

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");
  const { createOrder, markOrderPaid } = await import("@/lib/server/orders");

  /**
   * Its own event and its own paid order.
   *
   * This used to pick `findFirst({ orders: { some: { status: PAID } } })`, and
   * a clean seed has no orders at all — it only ever found one because other
   * suites left theirs behind. Passing on another suite's litter is not
   * passing.
   */
  const workspace = await db.workspace.findFirstOrThrow({ select: { id: true } });
  const venue = await db.venue.create({
    data: { name: "سالن آزمون قالب", city: "تهران", address: "-", capacity: 30 },
  });
  trackVenue(venue.id);
  const event = await db.event.create({
    data: {
      workspaceId: workspace.id,
      venueId: venue.id,
      title: "آزمون قالب بلیت",
      description: "",
      mode: "ONE_TIME",
      status: "PUBLISHED",
      sessions: {
        create: {
          startAt: new Date("2026-12-22T18:00:00Z"),
          endAt: new Date("2026-12-22T20:00:00Z"),
        },
      },
    },
    select: { id: true, ticketDesign: true },
  });
  eventId = trackEvent(event.id);
  original = event.ticketDesign ?? null;

  const type = await db.ticketType.create({
    data: {
      eventId,
      name: "عادی",
      price: 60_000,
      capacity: 20,
      salesStartAt: new Date("2020-01-01T00:00:00Z"),
      salesEndAt: new Date("2030-01-01T00:00:00Z"),
      category: "GENERAL",
    },
    select: { id: true },
  });
  const placed = await createOrder({
    eventId,
    items: [{ ticketTypeId: type.id, quantity: 1 }],
    buyerName: "آزمون قالب",
    buyerPhone: "09121119300",
  });
  await markOrderPaid(placed.order.id, {
    provider: "mock",
    authority: `td-${placed.order.id}`,
  });
});

afterEach(async () => {
  if (!eventId) return;
  const { db } = await import("@/lib/server/db");
  await db.event.update({
    where: { id: eventId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { ticketDesign: (original ?? null) as any },
  });
});

afterAll(async () => {
  const { db } = await import("@/lib/server/db");
  await dropTrackedEvents();
  await db.venue.deleteMany({ where: { name: "سالن آزمون قالب" } });
  await db.attendee.deleteMany({ where: { phone: "09121119300" } });
});

describeApi("ticket design", () => {
  it("survives a save and comes back on the event", async () => {
    const { updateEvent, getEventById } = await import("@/lib/server/events");

    await updateEvent(eventId, { ticketDesign: design });
    const event = await getEventById(eventId);

    expect(event?.ticketDesign).toMatchObject(design);
  });

  it("reaches the buyer's issued ticket", async () => {
    const { db } = await import("@/lib/server/db");
    const { updateEvent, getEventById } = await import("@/lib/server/events");
    const { ticketsForOrderCode } = await import("@/lib/server/orders");

    await updateEvent(eventId, { ticketDesign: design });
    expect((await getEventById(eventId))?.ticketDesign).toBeDefined();

    const order = await db.order.findFirstOrThrow({
      where: { eventId, status: "PAID", tickets: { some: {} } },
      select: { code: true },
    });
    const tickets = await ticketsForOrderCode(order.code);

    expect(tickets.length).toBeGreaterThan(0);
    // The whole point: what the organiser designed is what the buyer receives.
    expect(tickets[0].design).toMatchObject(design);
  });

  it("is replaced whole, so clearing an image actually clears it", async () => {
    const { updateEvent, getEventById } = await import("@/lib/server/events");

    await updateEvent(eventId, {
      ticketDesign: { ...design, logo: null, note: "با لوگو" },
    });
    await updateEvent(eventId, { ticketDesign: { accent: "#000000" } });

    const event = await getEventById(eventId);
    // A merge would have left «با لوگو» behind. The designer always sends the
    // complete template, so a partial write must not linger.
    expect(event?.ticketDesign).toEqual({ accent: "#000000" });
  });

  it("leaves the design alone when an unrelated field is patched", async () => {
    const { updateEvent, getEventById } = await import("@/lib/server/events");

    await updateEvent(eventId, { ticketDesign: design });
    await updateEvent(eventId, { title: (await getEventById(eventId))!.title });

    expect((await getEventById(eventId))?.ticketDesign).toMatchObject(design);
  });

  it("rejects a colour that is not a hex value", async () => {
    const { ticketDesignSchema } = await import("@/lib/server/schemas/event");
    // Interpolated straight into a style attribute, so this is the boundary
    // that keeps `javascript:` and friends out of the ticket.
    expect(ticketDesignSchema.safeParse({ accent: "red" }).success).toBe(false);
    expect(
      ticketDesignSchema.safeParse({ accent: "#ff0000" }).success,
    ).toBe(true);
  });

  it("rejects an oversized or non-image data URL", async () => {
    const { ticketDesignSchema } = await import("@/lib/server/schemas/event");

    expect(
      ticketDesignSchema.safeParse({ logo: "https://example.com/a.png" })
        .success,
    ).toBe(false);

    const huge = "data:image/png;base64," + "A".repeat(600_000);
    expect(ticketDesignSchema.safeParse({ logo: huge }).success).toBe(false);

    expect(
      ticketDesignSchema.safeParse({ logo: "data:image/png;base64,AAAA" })
        .success,
    ).toBe(true);
  });

  it("accepts an empty design without erasing the event", async () => {
    const { updateEvent, getEventById } = await import("@/lib/server/events");
    const before = await getEventById(eventId);

    await updateEvent(eventId, { ticketDesign: {} });
    const after = await getEventById(eventId);

    expect(after?.title).toBe(before?.title);
    expect(after?.ticketDesign).toEqual({});
  });
});
