/**
 * A selection that spans sections, on separate clocks.
 *
 * `holdSeats` stamps `now + 20 minutes` at the moment of each acquisition, so
 * seats picked ten minutes apart lapse ten minutes apart. The picker kept a
 * single deadline and the last response overwrote the rest, so the countdown
 * showed the *newest* — a buyer watched «۱۹:۵۸» tick down while the seats they
 * chose first were already gone.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

import {
  dropLapsed,
  earliestDeadline,
  lapsedSections,
  needsSeatResync,
} from "@/lib/venues/selection";

const T = (offsetMinutes: number) =>
  new Date(Date.UTC(2026, 6, 30, 12, 0, 0) + offsetMinutes * 60_000).toISOString();
const NOW = Date.UTC(2026, 6, 30, 12, 0, 0);

describe("earliest deadline", () => {
  it("returns the soonest, not the most recent", () => {
    const picks = { vip: [{ index: 1 }], balcony: [{ index: 2 }] };
    const expiries = { vip: T(4), balcony: T(19) };
    // The one that actually starts costing them seats.
    expect(earliestDeadline(picks, expiries)).toBe(T(4));
  });

  it("ignores a deadline whose seats were released", () => {
    const picks = { vip: [], balcony: [{ index: 2 }] };
    const expiries = { vip: T(1), balcony: T(19) };
    // A stale deadline would end the countdown eighteen minutes early.
    expect(earliestDeadline(picks, expiries)).toBe(T(19));
  });

  it("is null when nothing is held", () => {
    expect(earliestDeadline({}, {})).toBeNull();
    expect(earliestDeadline({ vip: [] }, { vip: T(9) })).toBeNull();
  });

  it("skips an unparseable timestamp rather than sorting it first", () => {
    const picks = { a: [{ index: 1 }], b: [{ index: 2 }] };
    expect(earliestDeadline(picks, { a: "not a date", b: T(5) })).toBe(T(5));
  });

  it("orders ISO strings correctly across an hour boundary", () => {
    const picks = { a: [{ index: 1 }], b: [{ index: 2 }] };
    // 12:59 vs 13:04 — lexicographic order on UTC ISO is the same as temporal.
    expect(earliestDeadline(picks, { a: T(64), b: T(59) })).toBe(T(59));
  });
});

describe("what a passing deadline takes", () => {
  it("names only the sections that actually lapsed", () => {
    const expiries = { vip: T(-1), stalls: T(0), balcony: T(5) };
    expect(lapsedSections(expiries, NOW).sort()).toEqual(["stalls", "vip"]);
  });

  it("keeps the seats that are still held", () => {
    const picks = { vip: [{ index: 1 }], balcony: [{ index: 2 }] };
    const expiries = { vip: T(-1), balcony: T(9) };

    const result = dropLapsed(picks, expiries, NOW);

    // Clearing everything here would throw away seats the buyer still has.
    expect(Object.keys(result.picks)).toEqual(["balcony"]);
    expect(result.expiries).toEqual({ balcony: T(9) });
    expect(result.lapsed).toEqual(["vip"]);
    expect(result.partial).toBe(true);
  });

  it("reports a total loss as total, not partial", () => {
    const picks = { vip: [{ index: 1 }] };
    const result = dropLapsed(picks, { vip: T(-1) }, NOW);

    expect(result.picks).toEqual({});
    expect(result.partial).toBe(false);
  });

  it("does nothing when no deadline has passed", () => {
    const picks = { vip: [{ index: 1 }] };
    const expiries = { vip: T(3) };
    const result = dropLapsed(picks, expiries, NOW);

    expect(result.lapsed).toEqual([]);
    expect(result.picks).toEqual(picks);
    expect(result.partial).toBe(false);
  });

  it("does not mutate what it was given", () => {
    const picks = { vip: [{ index: 1 }], balcony: [{ index: 2 }] };
    const expiries = { vip: T(-1), balcony: T(9) };

    dropLapsed(picks, expiries, NOW);

    expect(Object.keys(picks).sort()).toEqual(["balcony", "vip"]);
    expect(Object.keys(expiries).sort()).toEqual(["balcony", "vip"]);
  });

  it("treats a deadline exactly at now as passed", () => {
    // The hold is `expiresAt < now()` server-side on the *next* write, so the
    // client rounding the other way would show a seat as held that the next
    // buyer can already take.
    expect(lapsedSections({ vip: T(0) }, NOW)).toEqual(["vip"]);
  });
});

/**
 * Which server refusals mean the map is lying.
 *
 * This lived inside the checkout submit handler, where nothing could reach it
 * without a running server and a race — so the one branch that decides whether
 * to discard a buyer's seats had no test at all.
 */
describe("deciding when the map must re-check itself", () => {
  it("resyncs on the two codes that mean the seats are gone", () => {
    expect(needsSeatResync("HOLD_EXPIRED")).toBe(true);
    expect(needsSeatResync("SEAT_TAKEN")).toBe(true);
  });

  it("leaves the selection alone for refusals about anything else", () => {
    // Each of these is fixable in the form. Clearing the map would throw away
    // seats the buyer still holds while they correct a typo.
    for (const code of [
      "INVALID_BODY",
      "INVALID_JSON",
      "SOLD_OUT",
      "SALES_CLOSED",
      "DISCOUNT_EXHAUSTED",
      "FORBIDDEN",
      "UNAUTHENTICATED",
      "RATE_LIMITED",
      "HOLD_LIMIT",
      "PAYMENT_FAILED",
      "INTERNAL",
    ]) {
      expect(needsSeatResync(code)).toBe(false);
    }
  });

  it("does not resync on an unrecognised or absent code", () => {
    // `ErrorCode` grows. Defaulting to "discard the selection" would make every
    // future addition quietly destructive, so the predicate stays closed.
    for (const code of [undefined, null, "", "SOME_NEW_CODE", 0, {}, []]) {
      expect(needsSeatResync(code)).toBe(false);
    }
  });
});

/**
 * Two seams in the reservation chain that a reading alone will not hold.
 *
 * Source-level, because both are properties of how `markOrderPaid` is written
 * rather than of any one order, and reaching them through the database needs an
 * organiser deleting a pricing row inside a live hold.
 */
describe("settlement does not lose a seat quietly", () => {
  const orders = () =>
    readFileSync(join(process.cwd(), "lib/server/orders.ts"), "utf8");

  it("writes the whole settlement in one transaction", () => {
    // Tickets, sold counters, `SeatStatus` and the hold deletion have to land
    // together: money has already moved by this point, so a partial write is a
    // paid order whose seat is still on sale.
    const src = orders();
    const start = src.indexOf("await db.$transaction([", src.indexOf("const seatQueue"));
    expect(start).toBeGreaterThan(-1);
    const block = src.slice(start, start + 2500);
    expect(block).toContain("db.ticket.createMany");
    expect(block).toContain("db.seatStatus.create");
    expect(block).toMatch(/db\.seatHold\.deleteMany/);
  });

  it("logs when a seat is dropped for want of pricing", () => {
    /**
     * `priceSeatSelection` refuses a section with no pricing at order time, so
     * this is a known condition. At settlement it cannot refuse — the payment
     * is done — so the ticket is issued unseated while `SeatStatus` still marks
     * the seat sold. That leaves a row nobody's ticket points at, which someone
     * has to reconcile; skipping it in silence left no trace it had happened.
     */
    const src = orders();
    const loop = src.slice(src.indexOf("for (const hold of seatHolds)"));
    expect(loop.slice(0, 1800)).toMatch(/console\.error/);
    expect(loop.slice(0, 1800)).toMatch(/orderId: row\.id/);
  });
});
