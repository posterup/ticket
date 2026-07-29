import { describe, it, expect } from "vitest";

import {
  classifyRequestCode,
  classifyVerifyCode,
  extractCode,
  failureMessage,
  gatewayAmount,
  isRetryable,
  isSettled,
  MIN_AMOUNT_TOMAN,
  tomanFromGatewayAmount,
  ZARINPAL_CURRENCY,
} from "@/lib/server/payments/zarinpal-codes";

/**
 * The two failure modes worth guarding: charging ten times the intended amount
 * because the currency unit was assumed, and stranding a paying customer by
 * reading "already verified" as a failure.
 */

describe("currency conversion", () => {
  it("declares Toman, so the amount is passed through unchanged", () => {
    expect(ZARINPAL_CURRENCY).toBe("IRT");
    expect(gatewayAmount(1_500_000)).toBe(1_500_000);
    expect(gatewayAmount(1_500_000, "IRT")).toBe(1_500_000);
  });

  it("multiplies by ten when the amount is declared in Rial", () => {
    // Zarinpal's default. Getting this wrong is a silent 10x billing error.
    expect(gatewayAmount(1_500_000, "IRR")).toBe(15_000_000);
    expect(gatewayAmount(100, "IRR")).toBe(1_000);
  });

  it("round-trips back to Toman in both units", () => {
    for (const toman of [100, 12_345, 1_500_000]) {
      expect(tomanFromGatewayAmount(gatewayAmount(toman, "IRT"), "IRT")).toBe(
        toman,
      );
      expect(tomanFromGatewayAmount(gatewayAmount(toman, "IRR"), "IRR")).toBe(
        toman,
      );
    }
  });

  it("refuses a non-integer amount", () => {
    expect(() => gatewayAmount(1_000.5)).toThrow(/integer/i);
  });

  it("refuses an amount below the gateway minimum", () => {
    expect(() => gatewayAmount(MIN_AMOUNT_TOMAN - 1)).toThrow(/minimum/i);
    expect(() => gatewayAmount(0)).toThrow(/minimum/i);
    // A free order must never reach the gateway at all.
    expect(gatewayAmount(MIN_AMOUNT_TOMAN)).toBe(MIN_AMOUNT_TOMAN);
  });
});

describe("request codes", () => {
  it("treats 100 as created and everything else as failed", () => {
    expect(classifyRequestCode(100)).toBe("created");
    for (const code of [101, -9, -11, -51, 0]) {
      expect(classifyRequestCode(code)).toBe("failed");
    }
  });
});

describe("verify codes", () => {
  it("treats 100 as verified", () => {
    expect(classifyVerifyCode(100)).toBe("verified");
  });

  it("treats 101 as already verified, which is a success", () => {
    // A double callback, or the buyer using the back button. Issuing a second
    // set of tickets here would be the bug.
    expect(classifyVerifyCode(101)).toBe("already-verified");
    expect(isSettled(101)).toBe(true);
  });

  it("treats everything else as failed", () => {
    for (const code of [-51, -53, -54, 0, 102]) {
      expect(classifyVerifyCode(code)).toBe("failed");
      expect(isSettled(code)).toBe(false);
    }
  });
});

describe("retry classification", () => {
  it("retries only transient gateway trouble", () => {
    expect(isRetryable(-12)).toBe(true); // too many attempts
    expect(isRetryable(-16)).toBe(true); // gateway unavailable
    expect(isRetryable(-52)).toBe(true); // unexpected gateway error
  });

  it("never retries a settled or rejected payment", () => {
    for (const code of [100, 101, -51, -53, -54, -33]) {
      expect(isRetryable(code)).toBe(false);
    }
  });
});

describe("failure messages", () => {
  it("gives a Persian reason for known codes", () => {
    expect(failureMessage(-51)).toBe("پرداخت ناموفق بود.");
    expect(failureMessage(-54)).toContain("منقضی");
  });

  it("falls back rather than leaking the gateway's English", () => {
    expect(failureMessage(-9999)).toBe("پرداخت انجام نشد.");
  });
});

describe("extractCode", () => {
  it("reads a success envelope", () => {
    expect(
      extractCode({
        data: { code: 100, message: "Success", authority: "A0000000001" },
        errors: [],
      }),
    ).toBe(100);
  });

  it("reads a verify envelope carrying a ref id", () => {
    expect(
      extractCode({
        data: { code: 101, message: "Verified", ref_id: 201, card_pan: "6037" },
        errors: [],
      }),
    ).toBe(101);
  });

  it("reads a failure reported through the errors array", () => {
    expect(
      extractCode({ data: null, errors: [{ code: -11, message: "Not found" }] }),
    ).toBe(-11);
  });

  it("reads a validation failure where errors is an object, not an array", () => {
    // Zarinpal returns a field-keyed object for validation errors.
    expect(
      extractCode({
        data: null,
        errors: { code: -9, message: "Validation error", validations: {} },
      }),
    ).toBe(-9);
  });

  it("returns null when no code is present, so the caller fails closed", () => {
    expect(extractCode({})).toBeNull();
    expect(extractCode({ data: null, errors: [] })).toBeNull();
    expect(extractCode({ data: { message: "?" } })).toBeNull();
  });
});
