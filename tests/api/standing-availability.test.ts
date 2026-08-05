/**
 * How many places a section really has left.
 *
 * Availability was `section.capacity − (sold + held seats)`. For a seated
 * section the sparse seat rows make that exact; for a **standing** section
 * there are no seat rows at all, so the subtrahend was always zero and a
 * 3,000-capacity floor advertised 3,000 places forever, however many tickets
 * had been sold.
 *
 * The seated sections were wrong too, just less visibly: every line is reserved
 * against the `TicketType` in `createOrder`, and an organiser who maps a
 * 1,496-seat stand to a 200-ticket allocation has 140 to sell, not 1,496. The
 * buyer picked seats, filled in the form, and met `SOLD_OUT` at submit.
 */

import { it, expect, beforeAll, afterEach } from "vitest";

import { describeApi, restoreInventory } from "./helpers";

let sessionId = "";
let eventId = "";
let standingKey = "";
let standingTicketTypeId = "";

const buyer = { buyerName: "آزمون ایستاده", buyerPhone: "09121113000" };
const created: string[] = [];

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");

  const pricing = await db.sessionSectionPricing.findFirst({
    where: { section: { kind: "STANDING" } },
    orderBy: { sectionId: "asc" },
    select: {
      eventId: true,
      ticketTypeId: true,
      section: { select: { key: true, versionId: true } },
    },
  });
  if (!pricing) return;
  eventId = pricing.eventId;
  standingKey = pricing.section.key;
  standingTicketTypeId = pricing.ticketTypeId;

  sessionId =
    (
      await db.eventSession.findFirst({
        where: { eventId, layoutVersionId: pricing.section.versionId },
        select: { id: true },
      })
    )?.id ?? "";
});

afterEach(async () => {
  if (!created.length) return;
  const { db } = await import("@/lib/server/db");
  await restoreInventory(created);
  await db.ticket.deleteMany({ where: { orderId: { in: created } } });
  await db.orderItem.deleteMany({ where: { orderId: { in: created } } });
  await db.order.deleteMany({ where: { id: { in: created } } });
  created.length = 0;
  await db.attendee.deleteMany({ where: { phone: buyer.buyerPhone } });
});

const sections = async () => {
  const { getAvailability } = await import("@/lib/server/venues/seatmap");
  const snapshot = await getAvailability(sessionId);
  return new Map(snapshot.sections.map((s) => [s.key, s]));
};

describeApi("how many places are left", () => {
  it("reports the standing floor's ticket allocation, not the room's size", async () => {
    const { db } = await import("@/lib/server/db");
    const type = await db.ticketType.findUniqueOrThrow({
      where: { id: standingTicketTypeId },
      select: { capacity: true, sold: true, reserved: true },
    });
    const section = await db.venueSection.findFirstOrThrow({
      where: { key: standingKey, kind: "STANDING" },
      select: { capacity: true },
    });

    const remaining = type.capacity - type.sold - type.reserved;
    // The fixture is only meaningful if the room is bigger than the allocation.
    expect(section.capacity).toBeGreaterThan(remaining);

    const floor = (await sections()).get(standingKey)!;
    expect(floor.available).toBe(remaining);
    expect(floor.available).toBeLessThan(section.capacity);
  });

  it("falls once standing tickets are actually sold", async () => {
    const { createOrder } = await import("@/lib/server/orders");
    const before = (await sections()).get(standingKey)!.available;

    const result = await createOrder({
      eventId,
      sessionId,
      items: [{ ticketTypeId: standingTicketTypeId, quantity: 3 }],
      ...buyer,
    });
    created.push(result.order.id);

    // Reserved, not yet paid — and already unavailable to anyone else.
    expect((await sections()).get(standingKey)!.available).toBe(before - 3);
  });

  it("still lets the room be the limit when it is the smaller one", async () => {
    const { db } = await import("@/lib/server/db");
    const all = await sections();

    // A section physically smaller than its ticket type's remainder must report
    // its own size — the min has to work in both directions.
    const rows = await db.sessionSectionPricing.findMany({
      where: { eventId },
      select: {
        section: { select: { key: true, capacity: true, kind: true } },
        ticketType: { select: { capacity: true, sold: true, reserved: true } },
      },
    });
    const small = rows.find(
      (r) =>
        r.section.capacity <
        r.ticketType.capacity - r.ticketType.sold - r.ticketType.reserved,
    );
    if (!small) return;

    expect(all.get(small.section.key)!.available).toBe(small.section.capacity);
  });

  it("gives sections sharing a ticket type the same remainder", async () => {
    const { db } = await import("@/lib/server/db");
    const rows = await db.sessionSectionPricing.findMany({
      where: { eventId },
      select: { ticketTypeId: true, section: { select: { key: true } } },
    });

    const byType = new Map<string, string[]>();
    for (const r of rows) {
      byType.set(r.ticketTypeId, [
        ...(byType.get(r.ticketTypeId) ?? []),
        r.section.key,
      ]);
    }
    const shared = [...byType.values()].find((keys) => keys.length > 1);
    if (!shared) return;

    const all = await sections();
    const type = await db.sessionSectionPricing.findFirstOrThrow({
      where: { eventId, section: { key: shared[0] } },
      select: {
        ticketType: { select: { capacity: true, sold: true, reserved: true } },
      },
    });
    const remaining =
      type.ticketType.capacity -
      type.ticketType.sold -
      type.ticketType.reserved;

    // Each is capped by the same remainder rather than given a slice of it:
    // "you could buy up to N here" is true of every one of them, and any split
    // would be a guess about who buys first. A section physically smaller than
    // the remainder still reports its own size.
    for (const key of shared) {
      const section = await db.venueSection.findFirstOrThrow({
        where: { key, versionId: { not: undefined } },
        select: { capacity: true },
      });
      expect(all.get(key)!.available).toBe(
        Math.min(section.capacity, remaining),
      );
    }
  });

  it("never reports a negative number", async () => {
    const all = await sections();
    for (const s of all.values()) {
      expect(s.available).toBeGreaterThanOrEqual(0);
    }
  });

  it("grades the indicator against the same ceiling it reported", async () => {
    const { db } = await import("@/lib/server/db");
    const type = await db.ticketType.findUniqueOrThrow({
      where: { id: standingTicketTypeId },
      select: { capacity: true, sold: true, reserved: true },
    });
    const remaining = type.capacity - type.sold - type.reserved;

    const section = await db.venueSection.findFirstOrThrow({
      where: { key: standingKey, kind: "STANDING" },
      select: { capacity: true },
    });
    const ceiling = Math.min(section.capacity, type.capacity);
    const ratio = remaining / ceiling;
    const expected =
      remaining <= 0
        ? "sold-out"
        : ratio <= 0.05
          ? "almost-full"
          : ratio <= 0.25
            ? "limited"
            : "available";

    const floor = (await sections()).get(standingKey)!;
    // Graded against the ceiling that produced the number. Grading 140-left
    // against a 3,000-capacity room gives a 4.7% ratio and reads «almost-full»
    // for a floor that has 70% of its allocation intact.
    expect(floor.indicator).toBe(expected);
    expect(floor.indicator).not.toBe("almost-full");
  });
});
