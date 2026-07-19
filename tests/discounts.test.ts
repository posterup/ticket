import { describe, it, expect } from "vitest";

import {
  computeDiscountAmount,
  validateDiscount,
} from "@/lib/server/discounts";
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
    expiresAt: null,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeDiscountAmount", () => {
  it("percent floors and never exceeds the subtotal", () => {
    expect(computeDiscountAmount(code({ kind: "percent", value: 10 }), 2_800_000)).toBe(280_000);
    expect(computeDiscountAmount(code({ kind: "percent", value: 10 }), 12_345)).toBe(1_234);
  });

  it("fixed is capped at the subtotal", () => {
    expect(computeDiscountAmount(code({ kind: "fixed", value: 500_000 }), 2_000_000)).toBe(500_000);
    expect(computeDiscountAmount(code({ kind: "fixed", value: 500_000 }), 300_000)).toBe(300_000);
  });
});

describe("validateDiscount (seeded codes)", () => {
  it("applies an org-wide percent code to any event", () => {
    const r = validateDiscount("WELCOME10", OTHER, 1_000_000);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.discountAmount).toBe(100_000);
      expect(r.total).toBe(900_000);
    }
  });

  it("is case-insensitive and trims", () => {
    expect(validateDiscount("  welcome10 ", OTHER, 1_000_000).ok).toBe(true);
  });

  it("rejects an unknown code", () => {
    const r = validateDiscount("NOPE", OTHER, 1_000_000);
    expect(r.ok).toBe(false);
  });

  it("rejects a code scoped to a different event", () => {
    // EARLY is scoped to the concert event.
    const r = validateDiscount("EARLY", OTHER, 1_000_000);
    expect(r.ok).toBe(false);
  });

  it("rejects a code that hit its redemption cap", () => {
    // VIP20 is seeded at 50/50 redemptions.
    const r = validateDiscount("VIP20", CONCERT, 1_000_000);
    expect(r.ok).toBe(false);
  });

  it("rejects an empty code and a zero subtotal", () => {
    expect(validateDiscount("", OTHER, 1_000_000).ok).toBe(false);
    expect(validateDiscount("WELCOME10", OTHER, 0).ok).toBe(false);
  });
});
