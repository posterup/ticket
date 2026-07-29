import { it, expect } from "vitest";

import { GET, POST } from "@/app/api/discounts/route";
import { POST as VALIDATE } from "@/app/api/discounts/validate/route";
import type { DiscountCode, DiscountValidation } from "@/types";

import { data, errorCode, parse, req , describeApi } from "./helpers";

const SEED_EVENT = "3f1a6c2e-0001-4a10-9b21-1a2b3c4d5e01";
const OTHER_EVENT = "3f1a6c2e-0002-4a10-9b21-1a2b3c4d5e02";

const validDiscount = {
  eventId: null,
  code: "TESTCODE",
  kind: "percent",
  value: 15,
  maxRedemptions: null,
  expiresAt: null,
};

describeApi("GET /api/discounts", () => {
  it("lists the seeded codes", async () => {
    const codes = data(await parse<DiscountCode[]>(await GET(req("GET", "/api/discounts"))));
    expect(codes.map((c) => c.code)).toEqual(
      expect.arrayContaining(["WELCOME10", "EARLY", "VIP20"]),
    );
  });

  it("scoping by event keeps org-wide codes", async () => {
    const codes = data(
      await parse<DiscountCode[]>(
        await GET(req("GET", `/api/discounts?eventId=${OTHER_EVENT}`)),
      ),
    );
    // WELCOME10 is org-wide (eventId null); EARLY belongs to the concert.
    expect(codes.map((c) => c.code)).toContain("WELCOME10");
    expect(codes.map((c) => c.code)).not.toContain("EARLY");
  });
});

describeApi("POST /api/discounts", () => {
  it("creates a code, normalised to upper case", async () => {
    const parsed = await parse<DiscountCode>(
      await POST(req("POST", "/api/discounts", { ...validDiscount, code: "lower1" })),
    );
    expect(parsed.status).toBe(201);
    const created = data(parsed);
    expect(created.code).toBe("LOWER1");
    expect(created.redemptions).toBe(0);
    expect(created.active).toBe(true);
  });

  it("409s a duplicate, case-insensitively", async () => {
    const first = await parse<DiscountCode>(
      await POST(req("POST", "/api/discounts", { ...validDiscount, code: "dupe1" })),
    );
    expect(first.status).toBe(201);

    const second = await parse<DiscountCode>(
      await POST(req("POST", "/api/discounts", { ...validDiscount, code: "DUPE1" })),
    );
    expect(second.status).toBe(409);
    expect(errorCode(second)).toBe("DUPLICATE");
  });

  it("rejects a percentage above 100", async () => {
    const parsed = await parse<DiscountCode>(
      await POST(
        req("POST", "/api/discounts", { ...validDiscount, code: "PCT101", value: 101 }),
      ),
    );
    expect(parsed.status).toBe(400);
    expect(errorCode(parsed)).toBe("INVALID_BODY");
  });

  it("allows a fixed amount above 100", async () => {
    const parsed = await parse<DiscountCode>(
      await POST(
        req("POST", "/api/discounts", {
          ...validDiscount,
          code: "FIXED1",
          kind: "fixed",
          value: 500_000,
        }),
      ),
    );
    expect(parsed.status).toBe(201);
  });

  it("rejects a code with punctuation or the wrong length", async () => {
    for (const code of ["ab", "has-dash", "x".repeat(21)]) {
      const parsed = await parse<DiscountCode>(
        await POST(req("POST", "/api/discounts", { ...validDiscount, code })),
      );
      expect(errorCode(parsed)).toBe("INVALID_BODY");
    }
  });

  it("rejects a zero or negative value", async () => {
    for (const value of [0, -5]) {
      const parsed = await parse<DiscountCode>(
        await POST(
          req("POST", "/api/discounts", { ...validDiscount, code: "ZERO1", value }),
        ),
      );
      expect(errorCode(parsed)).toBe("INVALID_BODY");
    }
  });
});

describeApi("POST /api/discounts/validate", () => {
  it("applies an org-wide code to any event", async () => {
    const parsed = await parse<DiscountValidation>(
      await VALIDATE(
        req("POST", "/", {
          code: "WELCOME10",
          eventId: OTHER_EVENT,
          subtotal: 1_000_000,
        }),
      ),
    );
    const result = data(parsed);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.discountAmount).toBe(100_000);
      expect(result.total).toBe(900_000);
    }
  });

  it("trims and upper-cases the submitted code", async () => {
    const parsed = await parse<DiscountValidation>(
      await VALIDATE(
        req("POST", "/", {
          code: "  welcome10 ",
          eventId: OTHER_EVENT,
          subtotal: 1_000_000,
        }),
      ),
    );
    expect(data(parsed).ok).toBe(true);
  });

  it("refuses a code scoped to another event, with a reason", async () => {
    const parsed = await parse<DiscountValidation>(
      await VALIDATE(
        req("POST", "/", { code: "EARLY", eventId: OTHER_EVENT, subtotal: 1_000_000 }),
      ),
    );
    // A refusal is still a 200 — it is an outcome, not a request error.
    expect(parsed.status).toBe(200);
    const result = data(parsed);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBeTruthy();
  });

  it("refuses a code that hit its redemption cap", async () => {
    const parsed = await parse<DiscountValidation>(
      await VALIDATE(
        req("POST", "/", { code: "VIP20", eventId: SEED_EVENT, subtotal: 1_000_000 }),
      ),
    );
    expect(data(parsed).ok).toBe(false);
  });

  it("refuses an unknown code", async () => {
    const parsed = await parse<DiscountValidation>(
      await VALIDATE(
        req("POST", "/", { code: "NOPE", eventId: SEED_EVENT, subtotal: 1_000_000 }),
      ),
    );
    expect(data(parsed).ok).toBe(false);
  });

  it("400s a body missing fields", async () => {
    const parsed = await parse<DiscountValidation>(
      await VALIDATE(req("POST", "/", { code: "WELCOME10" })),
    );
    expect(parsed.status).toBe(400);
    expect(errorCode(parsed)).toBe("INVALID_BODY");
  });
});
