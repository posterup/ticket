import { describe, it, expect } from "vitest";

import {
  checkDiscountEligibility,
  computeDiscountAmount,
  normalizeCode,
} from "@/lib/server/discounts/rules";
import type { DiscountCode } from "@/types";

const CONCERT = "3f1a6c2e-0001-4a10-9b21-1a2b3c4d5e01";
const OTHER = "3f1a6c2e-0002-4a10-9b21-1a2b3c4d5e02";

function code(overrides: Partial<DiscountCode>): DiscountCode {
  return {
    id: "x",
    eventId: null,
    code: "X",
    kind: "percent",
    value: 10,
    maxRedemptions: null,
    redemptions: 0,
    reserved: 0,
    expiresAt: null,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Convenience wrapper: the code was found, so eligibility is the question. */
function check(
  discount: DiscountCode | undefined,
  eventId: string,
  subtotal: number,
  now?: number,
) {
  return checkDiscountEligibility({
    rawCode: discount?.code ?? "X",
    discount,
    eventId,
    subtotal,
    now,
  });
}

describe("normalizeCode", () => {
  it("trims and upper-cases", () => {
    expect(normalizeCode("  welcome10 ")).toBe("WELCOME10");
    expect(normalizeCode("   ")).toBe("");
  });
});

describe("computeDiscountAmount", () => {
  it("percent floors and never exceeds the subtotal", () => {
    expect(computeDiscountAmount(code({ kind: "percent", value: 10 }), 2_800_000)).toBe(280_000);
    expect(computeDiscountAmount(code({ kind: "percent", value: 10 }), 12_345)).toBe(1_234);
  });

  it("fixed is capped so something is still payable", () => {
    expect(computeDiscountAmount(code({ kind: "fixed", value: 500_000 }), 2_000_000)).toBe(500_000);
    // Was capped at the subtotal, leaving nothing to pay; now it stops one
    // gateway minimum short of it.
    expect(computeDiscountAmount(code({ kind: "fixed", value: 500_000 }), 300_000)).toBe(299_900);
  });

  /**
   * A discount never takes an order to zero.
   *
   * `total === 0` makes `createOrder` settle the order itself and skip the
   * gateway, so a 100% code was a free-ticket generator in the hands of anyone
   * who had one. The floor is Zarinpal's own minimum: below it the order could
   * not be paid even if it tried.
   */
  it("never lets a discount reach zero", () => {
    for (const [kind, value] of [
      ["percent", 100],
      ["fixed", 5_000_000],
    ] as const) {
      const amount = computeDiscountAmount(code({ kind, value }), 1_000_000);
      expect(amount).toBe(999_900);
      expect(1_000_000 - amount).toBeGreaterThan(0);
    }
  });

  it("declines to discount a subtotal already under the floor", () => {
    // Nothing to clamp to. The gateway refuses such an order on its own terms;
    // this does not invent a second rule about it.
    expect(computeDiscountAmount(code({ kind: "percent", value: 50 }), 50)).toBe(0);
  });
});

describe("checkDiscountEligibility", () => {
  it("applies an org-wide percent code to any event", () => {
    const r = check(code({ eventId: null, kind: "percent", value: 10 }), OTHER, 1_000_000);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.discountAmount).toBe(100_000);
      expect(r.total).toBe(900_000);
    }
  });

  it("rejects an unknown code", () => {
    expect(check(undefined, OTHER, 1_000_000).ok).toBe(false);
  });

  it("rejects an inactive code", () => {
    expect(check(code({ active: false }), OTHER, 1_000_000).ok).toBe(false);
  });

  it("rejects a code scoped to a different event", () => {
    const scoped = code({ eventId: CONCERT });
    expect(check(scoped, OTHER, 1_000_000).ok).toBe(false);
    expect(check(scoped, CONCERT, 1_000_000).ok).toBe(true);
  });

  it("rejects a code that hit its redemption cap", () => {
    expect(check(code({ maxRedemptions: 50, redemptions: 50 }), OTHER, 1_000_000).ok).toBe(false);
    expect(check(code({ maxRedemptions: 50, redemptions: 49 }), OTHER, 1_000_000).ok).toBe(true);
  });

  it("rejects an expired code, using the injected clock", () => {
    const expiring = code({ expiresAt: "2026-08-01T20:30:00.000Z" });
    const before = Date.parse("2026-07-01T00:00:00.000Z");
    const after = Date.parse("2026-09-01T00:00:00.000Z");
    expect(check(expiring, OTHER, 1_000_000, before).ok).toBe(true);
    expect(check(expiring, OTHER, 1_000_000, after).ok).toBe(false);
  });

  it("rejects an empty code and a zero subtotal", () => {
    const r = checkDiscountEligibility({
      rawCode: "  ",
      discount: undefined,
      eventId: OTHER,
      subtotal: 1_000_000,
    });
    expect(r.ok).toBe(false);
    expect(check(code({}), OTHER, 0).ok).toBe(false);
  });
});
