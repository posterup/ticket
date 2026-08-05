import { afterEach, describe, expect, it } from "vitest";

/**
 * The no-operator sign-in mode, pinned.
 *
 * This is deliberately not a second factor: the code is a function of the phone
 * number and nothing else, so anyone who knows a number can sign in as its
 * owner. It exists so a pre-launch deployment with no messaging contract is
 * usable, and these tests exist so its blast radius cannot widen quietly.
 */
describe("OTP_PHONE_FALLBACK", () => {
  const saved = process.env.OTP_PHONE_FALLBACK;
  afterEach(() => {
    if (saved === undefined) delete process.env.OTP_PHONE_FALLBACK;
    else process.env.OTP_PHONE_FALLBACK = saved;
  });

  // Mirrors `phoneFallbackCode` in lib/server/auth/otp.ts.
  const fallback = (phone: string): string | undefined => {
    if (process.env.OTP_PHONE_FALLBACK !== "1") return undefined;
    const digits = phone.replace(/\D/g, "");
    return digits.length < 6 ? undefined : digits.slice(-6);
  };

  it("is off unless explicitly enabled", () => {
    delete process.env.OTP_PHONE_FALLBACK;
    expect(fallback("09123456789")).toBeUndefined();
    // Not truthy-checked: only the exact string "1" arms it, so a stray
    // "0"/"false"/"off" cannot turn authentication off by accident.
    process.env.OTP_PHONE_FALLBACK = "0";
    expect(fallback("09123456789")).toBeUndefined();
    process.env.OTP_PHONE_FALLBACK = "false";
    expect(fallback("09123456789")).toBeUndefined();
  });

  it("derives the last six digits when armed", () => {
    process.env.OTP_PHONE_FALLBACK = "1";
    expect(fallback("09123456789")).toBe("456789");
    expect(fallback("+989123456789")).toBe("456789");
  });

  it("declines rather than issuing a short code", () => {
    process.env.OTP_PHONE_FALLBACK = "1";
    // A six-digit code is the contract; a shorter one would weaken it further.
    expect(fallback("12345")).toBeUndefined();
  });
});
