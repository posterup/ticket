import { it, expect, beforeAll, afterAll } from "vitest";

import { GET, POST } from "@/app/api/discounts/route";
import { POST as VALIDATE } from "@/app/api/discounts/validate/route";
import type { DiscountCode, DiscountValidation } from "@/types";

import { data, errorCode, parse, req , describeApi , signInAsOwner } from "./helpers";

const SEED_EVENT = "3f1a6c2e-0001-4a10-9b21-1a2b3c4d5e01";
const OTHER_EVENT = "3f1a6c2e-0002-4a10-9b21-1a2b3c4d5e02";
/** A second event in the *same* workspace as the seeded codes. */
const SIBLING_EVENT = "3f1a6c2e-0015-4a10-9b21-1a2b3c4d5e15";

/** Codes these tests create; cleared up front so reruns start clean. */
const CREATED_CODES = ["LOWER1", "DUPE1", "PCT101", "FIXED1", "ZERO1", "TESTCODE"];

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  // Discount management is organiser-side.
  await signInAsOwner();
  const { db } = await import("@/lib/server/db");
  await db.discountCode.deleteMany({ where: { code: { in: CREATED_CODES } } });
});

const validDiscount = {
  eventId: null,
  code: "TESTCODE",
  kind: "percent",
  value: 15,
  maxRedemptions: null,
  expiresAt: null,
};

describeApi("GET /api/discounts", () => {
  it("requires an eventId", async () => {
    // Unscoped, this handed every discount code in the system to any caller.
    const parsed = await parse<DiscountCode[]>(
      await GET(req("GET", "/api/discounts")),
    );
    expect(parsed.status).toBe(400);
    expect(errorCode(parsed)).toBe("INVALID_QUERY");
  });

  it("lists an event's codes for its manager", async () => {
    const codes = data(
      await parse<DiscountCode[]>(
        await GET(req("GET", `/api/discounts?eventId=${SEED_EVENT}`)),
      ),
    );
    expect(codes.map((c) => c.code)).toEqual(
      expect.arrayContaining(["WELCOME10", "EARLY", "VIP20"]),
    );
  });

  it("refuses an anonymous caller", async () => {
    const { signOut, signInAsOwner: back } = await import("./helpers");
    await signOut();
    const parsed = await parse<DiscountCode[]>(
      await GET(req("GET", `/api/discounts?eventId=${SEED_EVENT}`)),
    );
    expect(parsed.status).toBe(401);
    expect(errorCode(parsed)).toBe("UNAUTHENTICATED");
    await back();
  });

  it("scoping by event keeps the workspace's own org-wide codes", async () => {
    // A sibling event in the *same* workspace as the codes. This used to read
    // OTHER_EVENT — which the comment above says belongs to negar-karimi — and
    // expect to see WELCOME10, a code owned by a different workspace. It was
    // asserting a cross-tenant leak.
    const codes = data(
      await parse<DiscountCode[]>(
        await GET(req("GET", `/api/discounts?eventId=${SIBLING_EVENT}`)),
      ),
    );
    // WELCOME10 is org-wide (eventId null); EARLY belongs to the concert.
    expect(codes.map((c) => c.code)).toContain("WELCOME10");
    expect(codes.map((c) => c.code)).not.toContain("EARLY");
  });

  it("hides one workspace's org-wide codes from another", async () => {
    const { signInAs } = await import("./helpers");
    await signInAs("09120000002");
    const codes = data(
      await parse<DiscountCode[]>(
        await GET(req("GET", `/api/discounts?eventId=${OTHER_EVENT}`)),
      ),
    );
    await signInAsOwner();
    // Code strings are usable secrets; redemption counts are competitive
    // intelligence. Neither belongs to a rival organiser.
    expect(codes.map((c) => c.code)).not.toContain("WELCOME10");
  });
});

/**
 * The POST cases create real codes and never removed them: DUPE1, FIXED1 and
 * LOWER1 had accumulated in the database, showing up in every listing and in
 * any query that counts codes.
 */
afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");
  const made = ["DUPE1", "FIXED1", "LOWER1", "ZERO1", "NEW10"];
  await db.discountRedemption.deleteMany({
    where: { discountCode: { code: { in: made } } },
  });
  await db.discountCode.deleteMany({ where: { code: { in: made } } });
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
  it("applies an org-wide code to any event of its own workspace", async () => {
    // Was "…to any event", asserted against OTHER_EVENT — which the comment
    // above says belongs to negar-karimi, a *different* workspace from
    // WELCOME10's owner. The test encoded a real bug as intended behaviour:
    // codes are unique per workspace and the schema is explicit that a null
    // eventId scopes to "every event of the workspace".
    const parsed = await parse<DiscountValidation>(
      await VALIDATE(
        req("POST", "/", {
          code: "WELCOME10",
          eventId: SEED_EVENT,
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

  it("refuses an org-wide code against another workspace's event", async () => {
    // A 50%-off code issued by one organiser must not discount another
    // organiser's tickets — funded by them, and burning the issuer's
    // redemption count to do it.
    const parsed = await parse<DiscountValidation>(
      await VALIDATE(
        req("POST", "/", {
          code: "WELCOME10",
          eventId: OTHER_EVENT,
          subtotal: 1_000_000,
        }),
      ),
    );
    expect(data(parsed).ok).toBe(false);
  });

  it("trims and upper-cases the submitted code", async () => {
    const parsed = await parse<DiscountValidation>(
      await VALIDATE(
        req("POST", "/", {
          code: "  welcome10 ",
          eventId: SEED_EVENT,
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
