import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect, afterEach } from "vitest";

import { normalizeMobile, phoneVariants, validRecipients } from "@/lib/server/sms/gateway";

// Pure — no database, no network.

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

async function select() {
  // Re-imported per case: the gateway reads env at call time, but the module
  // registry caches the factory, so this keeps cases independent.
  const { smsGateway } = await import("@/lib/server/sms");
  return smsGateway().provider;
}

describe("mobile normalisation", () => {
  it("accepts every form an Iranian number arrives in", () => {
    for (const raw of ["09121234567", "+989121234567", "989121234567", "9121234567"]) {
      expect(normalizeMobile(raw)).toBe("09121234567");
    }
  });

  it("strips separators", () => {
    expect(normalizeMobile("0912 123 4567")).toBe("09121234567");
    expect(normalizeMobile("0912-123-4567")).toBe("09121234567");
  });

  it("drops invalid numbers and de-duplicates", () => {
    expect(
      validRecipients(["09121234567", "09121234567", "12345", "", "+989121234567"]),
    ).toEqual(["09121234567"]);
  });
});

describe("provider selection", () => {
  it("honours an explicit choice", async () => {
    process.env.SMS_PROVIDER = "kavenegar";
    expect(await select()).toBe("kavenegar");
    process.env.SMS_PROVIDER = "smsir";
    expect(await select()).toBe("smsir");
  });

  it("falls back to whichever operator is configured", async () => {
    // An existing deployment that only ever set up sms.ir must keep working
    // without learning about a new variable.
    delete process.env.SMS_PROVIDER;
    delete process.env.KAVENEGAR_API_KEY;
    expect(await select()).toBe("smsir");

    process.env.KAVENEGAR_API_KEY = "test-key";
    expect(await select()).toBe("kavenegar");
  });

  it("reports itself unconfigured rather than pretending", async () => {
    process.env.SMS_PROVIDER = "kavenegar";
    delete process.env.KAVENEGAR_API_KEY;
    const { smsGateway } = await import("@/lib/server/sms");
    const gateway = smsGateway();
    expect(gateway.configured).toBe(false);

    // And a send names the missing variable instead of failing opaquely.
    const result = await gateway.sendBulk(["09121234567"], "سلام");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("KAVENEGAR_API_KEY");
  });
});

/**
 * Matching a phone against data nobody normalised.
 *
 * `Attendee.phone` and `EventRegistration.phone` are stored exactly as typed —
 * the seed fixtures alone hold both `+989121234567` and `09121234567` — so a
 * lookup that compares one spelling silently misses the others. That broke
 * audience targeting in both directions at once: the event was absent from the
 * listing (`phone: viewer.phone`) *and* refused at checkout.
 */
describe("phoneVariants", () => {
  const CANON = ["09121234567", "+989121234567", "989121234567", "9121234567"];

  it("matches every spelling of the same number, from any of them", () => {
    for (const input of CANON) {
      const variants = phoneVariants(input);
      for (const stored of CANON) {
        expect(variants).toContain(stored);
      }
    }
  });

  it("copes with the formatting a human types", () => {
    expect(phoneVariants(" 0912 123 4567 ")).toContain("+989121234567");
    expect(phoneVariants("0912-123-4567")).toContain("09121234567");
  });

  it("does not collapse two different numbers together", () => {
    const a = phoneVariants("09121234567");
    expect(a).not.toContain("09121234568");
    expect(a).not.toContain("+989121234568");
  });

  it("falls back to the raw input rather than inventing variants for junk", () => {
    // A landline, or a foreign number: return something matchable, not a set of
    // fabricated Iranian mobiles.
    expect(phoneVariants("02112345678")).toEqual(["02112345678"]);
    expect(phoneVariants("")).toEqual([]);
  });
});

/**
 * The write side, which is where the mixed formats came from.
 *
 * Reads now match every spelling via `phoneVariants`, but that is damage
 * control. The source was `markOrderPaid` upserting a CRM contact keyed on the
 * raw buyer input while the schema accepts three spellings of the same number —
 * so one person buying twice, typing it differently, became two contacts.
 *
 * Asserted at the source rather than through the database, because the property
 * that matters is "every write path normalises", and that is a fact about the
 * code, not about any one row.
 */
describe("phones are normalised on the way in", () => {
  const read = (p: string) =>
    readFileSync(join(process.cwd(), p), "utf8");

  it("normalises the CRM contact a sale creates", () => {
    const src = read("lib/server/orders.ts");
    // The unique key and the stored value must both be canonical.
    expect(src).toMatch(/phone: normalizeMobile\(row\.buyerPhone\)/);
    expect(src).not.toMatch(/phone: row\.buyerPhone,/);
  });

  it("looks for an existing contact in every spelling before creating one", () => {
    // Without this, normalising new writes would simply create a *second* row
    // beside each legacy one — the same bug with tidier data.
    expect(read("lib/server/orders.ts")).toMatch(
      /phone: \{ in: phoneVariants\(row\.buyerPhone\) \}/,
    );
  });

  it("normalises a registration request", () => {
    const src = read("lib/server/registrations.ts");
    expect(src).toMatch(/phone: normalizeMobile\(input\.phone\)/);
  });

  it("leaves the waitlist path alone, which already did this", () => {
    expect(read("lib/server/waitlist.ts")).toMatch(
      /const phone = normalizeMobile\(input\.phone\)/,
    );
  });
});
