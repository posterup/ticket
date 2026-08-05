/**
 * Holding the whole house.
 *
 * `MAX_SEATS_PER_HOLDER` is ten, and on its own it caps nothing. A guest's
 * `holderKey` is a cookie *they* control — `resolveHolderKey` mints it and sets
 * it — so a script that clears the cookie gets another ten seats, and another,
 * until it is holding every seat on sale. The venue design document called this
 * out (§13.11, "a trivial bot holds every seat in the house") and only the
 * per-holder half was ever built.
 *
 * The address is the part a cleared cookie cannot change. It is a ceiling on
 * damage rather than a bot detector: `x-forwarded-for` is spoofable by anyone
 * talking to the origin directly, which is why nothing here treats it as
 * authentication.
 */

import { it, expect, beforeAll, afterEach } from "vitest";

import { describeApi } from "./helpers";

let sessionId = "";
let sectionKey = "";
let free: number[] = [];

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");

  // A section big enough that the per-address ceiling, not the seat count, is
  // what stops the run.
  const pricing = await db.sessionSectionPricing.findFirst({
    where: { section: { kind: "SEATED", seatCount: { gt: 400 } } },
    orderBy: { sectionId: "asc" },
    select: {
      eventId: true,
      sectionId: true,
      section: { select: { key: true, versionId: true } },
    },
  });
  if (!pricing) return;
  sectionKey = pricing.section.key;

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

  const seats = await db.venueSeat.findMany({
    where: { sectionId: pricing.sectionId, kind: "STANDARD" },
    orderBy: { index: "asc" },
    take: 60,
    select: { index: true },
  });
  free = seats.map((s) => s.index);
});

afterEach(async () => {
  if (!sessionId) return;
  const { db } = await import("@/lib/server/db");
  await db.seatHold.deleteMany({ where: { sessionId } });
});

const hold = async (seats: number[], holderKey: string, ip?: string) => {
  const { holdSeats } = await import("@/lib/server/venues/holds");
  return holdSeats({ sessionId, section: sectionKey, seats, holderKey, ip });
};

describeApi("how many seats one machine can hold", () => {
  it("still lets one holder take their ten", async () => {
    const result = await hold(free.slice(0, 10), "buyer-1", "203.0.113.9");
    expect(result.acquired).toHaveLength(10);
  });

  it("stops a rotated cookie at the per-address ceiling", async () => {
    const { MAX_SEATS_PER_IP } = await import("@/lib/server/venues/holds");
    const ip = "203.0.113.10";

    // Three fresh holder keys, exactly as clearing the cookie would produce.
    for (let i = 0; i < MAX_SEATS_PER_IP / 10; i++) {
      const got = await hold(free.slice(i * 10, i * 10 + 10), `bot-${i}`, ip);
      expect(got.acquired).toHaveLength(10);
    }

    // The fourth key is a new identity and the same machine.
    await expect(hold(free.slice(30, 40), "bot-3", ip)).rejects.toThrow(
      /از این اتصال/,
    );
  });

  it("counts every holder key from the address, not just the current one", async () => {
    const { db } = await import("@/lib/server/db");
    const ip = "203.0.113.11";

    await hold(free.slice(0, 10), "bot-a", ip);
    await hold(free.slice(10, 20), "bot-b", ip);

    const held = await db.seatHold.count({ where: { sessionId, ip } });
    expect(held).toBe(20);

    // Ten more would be thirty — the ceiling — so eleven must not fit.
    await expect(hold(free.slice(20, 31), "bot-c", ip)).rejects.toThrow();
  });

  it("does not punish a different address", async () => {
    const { MAX_SEATS_PER_IP } = await import("@/lib/server/venues/holds");
    const busy = "203.0.113.12";
    for (let i = 0; i < MAX_SEATS_PER_IP / 10; i++) {
      await hold(free.slice(i * 10, i * 10 + 10), `bot-${i}`, busy);
    }

    // A real customer somewhere else is unaffected.
    const other = await hold(free.slice(30, 32), "someone-else", "198.51.100.7");
    expect(other.acquired).toHaveLength(2);
  });

  it("frees the allowance as holds lapse", async () => {
    const { db } = await import("@/lib/server/db");
    const { MAX_SEATS_PER_IP } = await import("@/lib/server/venues/holds");
    const ip = "203.0.113.13";

    for (let i = 0; i < MAX_SEATS_PER_IP / 10; i++) {
      await hold(free.slice(i * 10, i * 10 + 10), `bot-${i}`, ip);
    }
    await expect(hold(free.slice(30, 40), "bot-3", ip)).rejects.toThrow();

    await db.seatHold.updateMany({
      where: { sessionId, holderKey: "bot-0" },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    // A ceiling on *live* holds, not a permanent ban on the address.
    const after = await hold(free.slice(30, 40), "bot-3", ip);
    expect(after.acquired).toHaveLength(10);
  });

  it("applies the same ceiling to best-available, which claims seats itself", async () => {
    const { findBestAvailable } = await import(
      "@/lib/server/venues/best-available"
    );
    const { MAX_SEATS_PER_IP } = await import("@/lib/server/venues/holds");
    const ip = "203.0.113.14";

    for (let i = 0; i < MAX_SEATS_PER_IP / 10; i++) {
      await hold(free.slice(i * 10, i * 10 + 10), `bot-${i}`, ip);
    }

    // Otherwise it is simply a way round the ceiling.
    await expect(
      findBestAvailable({ sessionId, quantity: 2, holderKey: "bot-x", ip }),
    ).rejects.toThrow(/از این اتصال/);
  });

  it("still works when the address is unknown", async () => {
    // Behind a proxy that strips the header, or a server-side caller. The
    // per-holder cap still applies; there is simply no second ceiling.
    const result = await hold(free.slice(0, 10), "no-ip-buyer", undefined);
    expect(result.acquired).toHaveLength(10);
  });
});
