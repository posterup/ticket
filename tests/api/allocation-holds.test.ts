/**
 * A seat can be free while the ticket behind it is not.
 *
 * A section's seats and its `TicketType` are two different ceilings, and
 * `createOrder` reserves against the second. The hold path checked neither, so
 * a buyer could take seats in a section whose allocation was spent, hold them
 * for twenty minutes, and be refused at submit — while those seats were
 * unavailable to everyone else for a sale that could never complete.
 *
 * Live holds count against the allocation too. They do not touch `reserved`
 * (they are transient and swept), so without that, ten shoppers could each hold
 * the last ten seats of a ten-ticket allocation and nine would find out only at
 * checkout.
 */

import { it, expect, beforeAll, afterEach } from "vitest";

import { describeApi } from "./helpers";

let sessionId = "";
let sectionKey = "";
let sectionId = "";
let ticketTypeId = "";
let original: { capacity: number; sold: number; reserved: number } | null = null;
/** Eight standard seat indices in `sectionKey`, resolved in `beforeAll`. */
let free: number[] = [];

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");

  const pricing = await db.sessionSectionPricing.findFirst({
    where: { section: { kind: "SEATED", seatCount: { gt: 50 } } },
    orderBy: { sectionId: "asc" },
    select: {
      eventId: true,
      sectionId: true,
      ticketTypeId: true,
      section: { select: { key: true, versionId: true } },
    },
  });
  if (!pricing) return;
  sectionKey = pricing.section.key;
  sectionId = pricing.sectionId;
  ticketTypeId = pricing.ticketTypeId;

  sessionId =
    (
      await db.eventSession.findFirst({
        where: {
          eventId: pricing.eventId,
          layoutVersionId: pricing.section.versionId,
        },
        select: { id: true },
      })
    )?.id ?? "";

  original = await db.ticketType.findUniqueOrThrow({
    where: { id: ticketTypeId },
    select: { capacity: true, sold: true, reserved: true },
  });

  /**
   * Real standard seats, resolved rather than guessed.
   *
   * These indices were hardcoded as 7, 8, 9…, which happened to work only
   * while the database held leftover sections from other suites. Against a
   * clean seed the same query lands on the stalls, where those indices are
   * *house* seats — the hold is refused for the right reason and the test
   * fails for the wrong one.
   */
  const seats = await db.venueSeat.findMany({
    where: { sectionId, kind: "STANDARD" },
    orderBy: { index: "asc" },
    take: 8,
    select: { index: true },
  });
  free = seats.map((s) => s.index);
});

afterEach(async () => {
  if (!ticketTypeId || !original) return;
  const { db } = await import("@/lib/server/db");
  await db.seatHold.deleteMany({ where: { sessionId } });
  await db.ticketType.update({ where: { id: ticketTypeId }, data: original });
});

/** Leave exactly `n` tickets in the section's allocation. */
async function leave(n: number) {
  const { db } = await import("@/lib/server/db");
  await db.ticketType.update({
    where: { id: ticketTypeId },
    data: { sold: original!.capacity - n, reserved: 0 },
  });
}

const hold = async (seats: number[], holderKey = "buyer-a") => {
  const { holdSeats } = await import("@/lib/server/venues/holds");
  return holdSeats({ sessionId, section: sectionKey, seats, holderKey });
};

describeApi("holding against a ticket allocation", () => {
  it("refuses free seats when the allocation is spent", async () => {
    await leave(0);
    // The seats themselves are untouched — nothing is sold or held on them.
    await expect(hold([free[0], free[1]])).rejects.toThrow(/تکمیل شده/);
  });

  it("allows exactly what is left, and no more", async () => {
    await leave(2);

    const ok = await hold([free[0], free[1]]);
    expect(ok.acquired).toEqual([free[0], free[1]].sort((a, b) => a - b));

    // The third would overdraw the allocation even though seat 9 is free.
    await expect(hold([free[2]])).rejects.toThrow();
  });

  it("counts the caller's existing holds against their own limit", async () => {
    await leave(3);
    await hold([free[0], free[1]]);

    // One left: two more is too many.
    await expect(hold([free[2], free[3]])).rejects.toThrow();
    const ok = await hold([free[2]]);
    expect(ok.acquired).toEqual([free[2]]);
  });

  it("counts another shopper's live holds too", async () => {
    await leave(2);
    await hold([free[0], free[1]], "buyer-a");

    // Holds never touch `reserved`, so without this the allocation would look
    // untouched and both shoppers would reach checkout for the same two tickets.
    await expect(hold([free[4], free[5]], "buyer-b")).rejects.toThrow(/تکمیل شده/);
  });

  it("says how many are left when the request is merely too big", async () => {
    await leave(2);
    await expect(hold([free[0], free[1], free[2]])).rejects.toThrow(/۲/);
  });

  it("frees up again when a hold lapses", async () => {
    const { db } = await import("@/lib/server/db");
    await leave(1);
    await hold([free[0]], "buyer-a");

    await expect(hold([free[4]], "buyer-b")).rejects.toThrow();

    // Backdate the first hold past its deadline.
    await db.seatHold.updateMany({
      where: { sessionId, holderKey: "buyer-a" },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const ok = await hold([free[4]], "buyer-b");
    expect(ok.acquired).toEqual([free[4]]);
  });

  it("leaves best-available to fall through to a tier that can serve it", async () => {
    const { findBestAvailable } = await import(
      "@/lib/server/venues/best-available"
    );
    await leave(0);

    // The picker claims seats directly rather than going through holdSeats, so
    // it needs the same check — otherwise it hands out seats from a spent tier.
    const result = await findBestAvailable({
      sessionId,
      quantity: 2,
      holderKey: "buyer-c",
    }).catch(() => null);

    if (result) {
      expect(result.section).not.toBe(sectionKey);
    }

    const { db } = await import("@/lib/server/db");
    const mine = await db.seatHold.findMany({
      where: { sessionId, holderKey: "buyer-c" },
      select: { seat: { select: { sectionId: true } } },
    });
    for (const h of mine) expect(h.seat.sectionId).not.toBe(sectionId);
  });

  it("does not limit a section the organiser never priced", async () => {
    const { db } = await import("@/lib/server/db");

    // The fixture prices every section, so unprice one for the duration. The
    // condition is real — a layout can outlive the pricing set up for it — and
    // a test that quietly returns early when it cannot find one is not
    // coverage, it just looks like it.
    const pricing = await db.sessionSectionPricing.findFirstOrThrow({
      where: { sectionId },
      select: {
        id: true,
        eventId: true,
        sectionId: true,
        ticketTypeId: true,
      },
    });
    await leave(0);
    await db.sessionSectionPricing.delete({ where: { id: pricing.id } });

    try {
      // priceSeatSelection refuses an unpriced section at checkout with a
      // clearer error; inventing an allocation limit here would mask it.
      const ok = await hold([free[6], free[7]], "buyer-e");
      expect(ok.acquired).toEqual([free[6], free[7]].sort((a, b) => a - b));
    } finally {
      await db.sessionSectionPricing.create({
        data: {
          eventId: pricing.eventId,
          sectionId: pricing.sectionId,
          ticketTypeId: pricing.ticketTypeId,
        },
      });
    }
  });
});
