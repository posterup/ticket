/**
 * "Pick good seats for me."
 *
 * The interesting behaviour is not that it returns seats — it is *which* seats,
 * and what it refuses to hand out. Accessible spaces and house seats are the
 * two kinds that must never fall out of a generic request, and the tier order
 * is the only thing that makes "best" mean anything.
 */

import { it, expect, beforeAll, afterEach } from "vitest";

import { POST as BEST } from "@/app/api/sessions/[id]/best-available/route";
import type { BestAvailableResult } from "@/lib/server/venues/best-available";

import { ctx, data, describeApi, errorCode, parse, req } from "./helpers";

let sessionId = "";
let eventId = "";

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");
  // The theatre, not the arena: it has four authored tiers at two price points,
  // which is what makes the ordering and budget cases meaningful.
  const session = await db.eventSession.findFirst({
    where: {
      layoutVersionId: { not: null },
      event: { title: { contains: "همایون" } },
    },
    select: { id: true, eventId: true },
  });
  sessionId = session?.id ?? "";
  eventId = session?.eventId ?? "";
});

afterEach(async () => {
  if (!sessionId) return;
  const { db } = await import("@/lib/server/db");
  await db.seatHold.deleteMany({ where: { sessionId } });
});

const ask = (body: Record<string, unknown>) =>
  BEST(req("POST", "/", body), ctx({ id: sessionId }));

describeApi("best available seats", () => {
  it("takes the closest tier when the house is empty", async () => {
    const res = data<BestAvailableResult>(await parse(await ask({ quantity: 2 })));

    // «ویژه» is tier 1; every other section is further back.
    expect(res.section).toBe("vip");
    expect(res.seats).toHaveLength(2);
    expect(res.unitPrice).toBe(5_500_000);
  });

  it("returns seats that are actually next to each other", async () => {
    const res = data<BestAvailableResult>(await parse(await ask({ quantity: 4 })));

    expect(res.seats).toHaveLength(4);
    for (let i = 1; i < res.seats.length; i++) {
      expect(res.seats[i]).toBe(res.seats[i - 1] + 1);
    }
    // …and in one row, so the labels share a row name.
    expect(res.rowLabel).not.toBe("");
    expect(res.seatLabels).toHaveLength(4);
  });

  it("holds what it picked, so a second caller cannot get the same seats", async () => {
    const first = data<BestAvailableResult>(
      await parse(await ask({ quantity: 2 })),
    );
    const { db } = await import("@/lib/server/db");

    const held = await db.seatHold.count({
      where: { sessionId, expiresAt: { gt: new Date() } },
    });
    expect(held).toBe(2);

    // A different holder asking for the same thing gets different seats.
    const second = data<BestAvailableResult>(
      await parse(
        await BEST(
          req("POST", "/", { quantity: 2 }),
          ctx({ id: sessionId }),
        ),
      ),
    );
    // Same holder key in-process, so this is the "already held" path rather
    // than a race: what matters is that it never re-issues a held seat.
    expect(second.seats.some((s) => first.seats.includes(s))).toBe(false);
  });

  it("stays inside a per-seat budget, dropping to a cheaper tier", async () => {
    const res = data<BestAvailableResult>(
      await parse(await ask({ quantity: 2, maxPrice: 3_000_000 })),
    );

    expect(res.section).not.toBe("vip");
    expect(res.unitPrice).toBeLessThanOrEqual(3_000_000);
  });

  it("refuses when nothing fits the budget", async () => {
    const res = await parse(await ask({ quantity: 2, maxPrice: 1000 }));
    expect(res.status).toBe(409);
    expect(errorCode(res)).toBe("CONFLICT");
  });

  it("honours an explicit section", async () => {
    const res = data<BestAvailableResult>(
      await parse(await ask({ quantity: 2, section: "balcony" })),
    );
    expect(res.section).toBe("balcony");
  });

  it("never hands out an accessible space to someone who did not ask", async () => {
    const { db } = await import("@/lib/server/db");
    const reserved = await db.venueSeat.findMany({
      where: {
        section: { key: "stalls", version: { sessions: { some: { id: sessionId } } } },
        kind: { in: ["WHEELCHAIR", "COMPANION", "HOUSE"] },
      },
      select: { index: true },
    });
    expect(reserved.length).toBeGreaterThan(0);

    // Drain the stalls of ordinary seats so the only thing left is reserved
    // inventory — if the picker were willing to use it, this is where it would.
    const ordinary = await db.venueSeat.findMany({
      where: {
        section: { key: "stalls", version: { sessions: { some: { id: sessionId } } } },
        kind: "STANDARD",
      },
      select: { id: true },
    });
    await db.seatHold.createMany({
      data: ordinary.map((s) => ({
        sessionId,
        seatId: s.id,
        holderKey: "other-shopper",
        expiresAt: new Date(Date.now() + 600_000),
      })),
    });

    const res = await parse(await ask({ quantity: 2, section: "stalls" }));
    expect(res.status).toBe(409);
    expect(errorCode(res)).toBe("SEAT_TAKEN");
  });

  it("finds wheelchair spaces when they are what was asked for", async () => {
    const res = data<BestAvailableResult>(
      await parse(await ask({ quantity: 2, section: "stalls", accessible: true })),
    );

    const { db } = await import("@/lib/server/db");
    const kinds = await db.venueSeat.findMany({
      where: {
        index: { in: res.seats },
        section: { key: "stalls", version: { sessions: { some: { id: sessionId } } } },
      },
      select: { kind: true },
    });
    expect(kinds).toHaveLength(2);
    for (const seat of kinds) {
      expect(["WHEELCHAIR", "COMPANION"]).toContain(seat.kind);
    }
  });

  it("counts against the same cap as hand-picked seats", async () => {
    await ask({ quantity: 8 });
    const res = await parse(await ask({ quantity: 8 }));

    expect(res.status).toBe(429);
    expect(errorCode(res)).toBe("HOLD_LIMIT");
  });

  it("rejects a quantity above the cap outright", async () => {
    const res = await parse(await ask({ quantity: 99 }));
    expect(res.status).toBe(400);
  });

  it("skips a tier that is not on sale yet", async () => {
    const { db } = await import("@/lib/server/db");
    const priced = await db.sessionSectionPricing.findFirst({
      where: { eventId, section: { key: "vip" } },
      select: { ticketTypeId: true },
    });
    const type = await db.ticketType.findUniqueOrThrow({
      where: { id: priced!.ticketTypeId },
      select: { salesStartAt: true },
    });

    await db.ticketType.update({
      where: { id: priced!.ticketTypeId },
      data: { salesStartAt: new Date(Date.now() + 7 * 86_400_000) },
    });
    try {
      const res = data<BestAvailableResult>(
        await parse(await ask({ quantity: 2 })),
      );
      // createOrder would reject this tier with SALES_CLOSED, so handing out
      // its seats means a 20-minute hold the buyer can never convert.
      expect(res.section).not.toBe("vip");
    } finally {
      await db.ticketType.update({
        where: { id: priced!.ticketTypeId },
        data: { salesStartAt: type.salesStartAt },
      });
    }
  });

  it("skips sections the organiser never priced", async () => {
    const { db } = await import("@/lib/server/db");
    const vip = await db.sessionSectionPricing.findFirst({
      where: { eventId, section: { key: "vip" } },
      select: { id: true, eventId: true, sectionId: true, ticketTypeId: true },
    });
    expect(vip).not.toBeNull();

    await db.sessionSectionPricing.delete({ where: { id: vip!.id } });
    try {
      const res = data<BestAvailableResult>(
        await parse(await ask({ quantity: 2 })),
      );
      // An unpriced section cannot be checked out, so recommending it would
      // hand the buyer a hold they can never convert.
      expect(res.section).not.toBe("vip");
    } finally {
      await db.sessionSectionPricing.create({ data: vip! });
    }
  });
});
