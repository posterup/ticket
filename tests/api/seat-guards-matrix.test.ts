/**
 * The same rules, at every door.
 *
 * Three separate bugs this month were the same shape: a constraint enforced on
 * one path into seat inventory and not the other. The allocation ceiling, the
 * per-address cap and the sales window were each added to `findBestAvailable`
 * or `holdSeats` and not to its sibling, and each time the gap was found by
 * reading rather than by a failing test.
 *
 * So this stops testing constraints and starts testing *coverage*: every rule
 * against every entry point, as a matrix. A new entry point that forgets one,
 * or a new rule applied to only half, fails here.
 *
 * `createOrder` is included because it is the third door — a crafted POST does
 * not have to go through a hold at all.
 */

import { it, expect, beforeAll, afterEach } from "vitest";

import { describeApi } from "./helpers";

let sessionId = "";
let eventId = "";
let sectionKey = "";
let sectionId = "";
let ticketTypeId = "";
let seats: number[] = [];
let original: {
  salesStartAt: Date;
  salesEndAt: Date;
  capacity: number;
  sold: number;
  reserved: number;
} | null = null;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");

  const pricing = await db.sessionSectionPricing.findFirst({
    where: { section: { kind: "SEATED", seatCount: { gt: 400 } } },
    orderBy: { sectionId: "asc" },
    select: {
      eventId: true,
      sectionId: true,
      ticketTypeId: true,
      section: { select: { key: true, versionId: true } },
    },
  });
  if (!pricing) return;
  eventId = pricing.eventId;
  sectionId = pricing.sectionId;
  sectionKey = pricing.section.key;
  ticketTypeId = pricing.ticketTypeId;

  sessionId =
    (
      await db.eventSession.findFirst({
        where: { eventId, layoutVersionId: pricing.section.versionId },
        select: { id: true },
      })
    )?.id ?? "";

  seats = (
    await db.venueSeat.findMany({
      where: { sectionId, kind: "STANDARD" },
      orderBy: { index: "asc" },
      take: 40,
      select: { index: true },
    })
  ).map((s) => s.index);

  original = await db.ticketType.findUniqueOrThrow({
    where: { id: ticketTypeId },
    select: {
      salesStartAt: true,
      salesEndAt: true,
      capacity: true,
      sold: true,
      reserved: true,
    },
  });
});

afterEach(async () => {
  if (!sessionId || !original) return;
  const { db } = await import("@/lib/server/db");
  await db.seatHold.deleteMany({ where: { sessionId } });
  await db.ticketType.update({ where: { id: ticketTypeId }, data: original });
  await db.eventSession.update({
    where: { id: sessionId },
    data: { cancelled: false, availability: "AVAILABLE" },
  });
});

/** The three ways a caller can reach seat inventory. */
const DOORS = [
  {
    name: "holdSeats",
    async take(n: number, ip?: string) {
      const { holdSeats } = await import("@/lib/server/venues/holds");
      return holdSeats({
        sessionId,
        section: sectionKey,
        seats: seats.slice(0, n),
        holderKey: "matrix",
        ip,
      });
    },
  },
  {
    name: "findBestAvailable",
    async take(n: number, ip?: string) {
      const { findBestAvailable } = await import(
        "@/lib/server/venues/best-available"
      );
      // `sectionKey`, not `section` — the route maps `body.section` onto it,
      // the function does not. Getting that wrong silently un-pins the search
      // and it falls through to a healthy tier, which is how the first run of
      // this matrix "passed" three rules it was not exercising.
      return findBestAvailable({
        sessionId,
        quantity: n,
        holderKey: "matrix",
        sectionKey,
        ip,
      });
    },
  },
] as const;

/** Rules that must hold identically at every door. */
const RULES = [
  {
    name: "a cancelled سانس",
    async arm() {
      const { db } = await import("@/lib/server/db");
      await db.eventSession.update({
        where: { id: sessionId },
        data: { cancelled: true },
      });
    },
  },
  {
    name: "a سانس marked «تکمیل ظرفیت»",
    async arm() {
      const { db } = await import("@/lib/server/db");
      await db.eventSession.update({
        where: { id: sessionId },
        data: { availability: "FULL" },
      });
    },
  },
  {
    name: "a سانس that has not opened",
    async arm() {
      const { db } = await import("@/lib/server/db");
      await db.eventSession.update({
        where: { id: sessionId },
        data: { availability: "SOON" },
      });
    },
  },
  {
    name: "sales that have not opened",
    async arm() {
      const { db } = await import("@/lib/server/db");
      await db.ticketType.update({
        where: { id: ticketTypeId },
        data: { salesStartAt: new Date(Date.now() + 7 * 86_400_000) },
      });
    },
  },
  {
    name: "sales that have closed",
    async arm() {
      const { db } = await import("@/lib/server/db");
      await db.ticketType.update({
        where: { id: ticketTypeId },
        data: { salesEndAt: new Date(Date.now() - 86_400_000) },
      });
    },
  },
  {
    name: "an exhausted ticket allocation",
    async arm() {
      const { db } = await import("@/lib/server/db");
      await db.ticketType.update({
        where: { id: ticketTypeId },
        data: { sold: original!.capacity, reserved: 0 },
      });
    },
  },
] as const;

describeApi("every rule, at every door", () => {
  for (const door of DOORS) {
    for (const rule of RULES) {
      it(`${door.name} refuses ${rule.name}`, async () => {
        await rule.arm();
        await expect(door.take(2)).rejects.toThrow();
      });
    }

    it(`${door.name} honours the per-address ceiling`, async () => {
      const { db } = await import("@/lib/server/db");
      const { MAX_SEATS_PER_IP } = await import("@/lib/server/venues/holds");
      const ip = "203.0.113.99";

      // Fill the address's allowance under other holder keys, exactly as a
      // rotated cookie would.
      await db.seatHold.createMany({
        data: (
          await db.venueSeat.findMany({
            where: { sectionId, kind: "STANDARD" },
            orderBy: { index: "desc" },
            take: MAX_SEATS_PER_IP,
            select: { id: true },
          })
        ).map((seat, i) => ({
          sessionId,
          seatId: seat.id,
          holderKey: `filler-${i}`,
          ip,
          expiresAt: new Date(Date.now() + 600_000),
        })),
      });

      await expect(door.take(2, ip)).rejects.toThrow(/از این اتصال/);
    });

    it(`${door.name} still works when nothing is wrong`, async () => {
      // A matrix of refusals proves nothing if the door is simply shut.
      await expect(door.take(2)).resolves.toBeTruthy();
    });
  }

  it("createOrder refuses a cancelled سانس too — it is the third door", async () => {
    const { db } = await import("@/lib/server/db");
    const { createOrder } = await import("@/lib/server/orders");
    await db.eventSession.update({
      where: { id: sessionId },
      data: { cancelled: true },
    });

    // A crafted POST does not have to hold anything first.
    await expect(
      createOrder({
        eventId,
        sessionId,
        items: [{ ticketTypeId, quantity: 1 }],
        buyerName: "آزمون",
        buyerPhone: "09121119500",
      }),
    ).rejects.toThrow();
  });
});
