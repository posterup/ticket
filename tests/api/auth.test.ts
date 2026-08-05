import { it, expect, beforeAll, vi } from "vitest";

import { POST as REQUEST_OTP } from "@/app/api/auth/otp/request/route";
import { POST as VERIFY_OTP } from "@/app/api/auth/otp/verify/route";
import { OTP_RESEND_SEC } from "@/lib/server/auth/otp";
import { randomSlug } from "@/lib/server/workspaces-create";

import { data, describeApi, errorCode, parse, req } from "./helpers";

/**
 * Next's `cookies()` needs a request context, which these in-process calls do
 * not have. Verifying a code sets the session cookie, so stub the store and
 * capture what was written.
 */
const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined,
    set: (name: string, value: string) => cookieJar.set(name, value),
    delete: (name: string) => cookieJar.delete(name),
  }),
}));

/** Reserved for this suite; cleared before each run. */
const TEST_PREFIX = "0913";
const SEEDED_MANAGER = "09120000001";

/** A fresh number per test, so the per-phone resend limit never collides. */
let counter = 0;
function freshPhone(): string {
  counter += 1;
  return `${TEST_PREFIX}${String(counter).padStart(7, "0")}`;
}

beforeAll(async () => {
  process.env.AUTH_SECRET ??= "test-secret";
  if (!process.env.DATABASE_URL) return;

  // The database persists between runs, so clear this suite's own history —
  // otherwise the second run is throttled by the first run's codes.
  const { db } = await import("@/lib/server/db");
  await db.otpCode.deleteMany({
    where: { OR: [{ phone: { startsWith: TEST_PREFIX } }, { phone: SEEDED_MANAGER }] },
  });
  await db.session.deleteMany({
    where: { user: { phone: { startsWith: TEST_PREFIX } } },
  });
  await db.user.deleteMany({ where: { phone: { startsWith: TEST_PREFIX } } });
});

async function requestCode(phone: string) {
  const parsed = await parse<{ devCode?: string; resendAfterSec: number }>(
    await REQUEST_OTP(req("POST", "/", { phone })),
  );
  return parsed;
}

describeApi("POST /api/auth/otp/request", () => {
  it("issues a code, and returns it outside production", async () => {
    const parsed = await requestCode(freshPhone());
    expect(parsed.status).toBe(200);
    const body = data(parsed);
    // With no SMS credentials the code comes back so development is unblocked.
    expect(body.devCode).toMatch(/^\d{6}$/);
    expect(body.resendAfterSec).toBe(OTP_RESEND_SEC);
  });

  it("normalises +98 and 98 prefixes to the same account", async () => {
    const phone = freshPhone();
    const international = `+98${phone.slice(1)}`;
    const first = await requestCode(phone);
    // Same number in another shape hits the resend limit, proving it normalised.
    const second = await parse(await REQUEST_OTP(req("POST", "/", { phone: international })));
    expect(data(first).devCode).toBeTruthy();
    expect(second.status).toBe(429);
    expect(errorCode(second)).toBe("RATE_LIMITED");
  });

  it("rate-limits an immediate resend", async () => {
    const phone = freshPhone();
    await requestCode(phone);
    const again = await parse(await REQUEST_OTP(req("POST", "/", { phone })));
    expect(again.status).toBe(429);
    expect(errorCode(again)).toBe("RATE_LIMITED");
  });

  it("rejects a malformed number", async () => {
    for (const phone of ["12345", "021123456", ""]) {
      const parsed = await parse(await REQUEST_OTP(req("POST", "/", { phone })));
      expect(parsed.status).toBe(400);
      expect(errorCode(parsed)).toBe("INVALID_BODY");
    }
  });
});

describeApi("POST /api/auth/otp/verify", () => {
  it("signs in a new user and reports them as new", async () => {
    const phone = freshPhone();
    const code = data(await requestCode(phone)).devCode!;

    const parsed = await parse<{ isNewUser: boolean; isManager: boolean }>(
      await VERIFY_OTP(req("POST", "/", { phone, code })),
    );
    expect(parsed.status).toBe(200);
    const body = data(parsed);
    expect(body.isNewUser).toBe(true);
    // A brand-new account owns no workspace, so the dashboard is not for them.
    expect(body.isManager).toBe(false);
  });

  it("recognises a returning user", async () => {
    const phone = freshPhone();
    const first = data(await requestCode(phone)).devCode!;
    await VERIFY_OTP(req("POST", "/", { phone, code: first }));

    // Wait out the resend window by using a different number would defeat the
    // point, so assert via a second code on the same account.
    const row = await import("@/lib/server/db").then(({ db }) =>
      db.otpCode.updateMany({ where: { phone }, data: { createdAt: new Date(0) } }),
    );
    expect(row.count).toBeGreaterThan(0);

    const second = data(await requestCode(phone)).devCode!;
    const parsed = await parse<{ isNewUser: boolean }>(
      await VERIFY_OTP(req("POST", "/", { phone, code: second })),
    );
    expect(data(parsed).isNewUser).toBe(false);
  });

  it("signs in the seeded manager and reports them as one", async () => {
    const { db } = await import("@/lib/server/db");
    const phone = "09120000001";
    await db.otpCode.updateMany({ where: { phone }, data: { createdAt: new Date(0) } });

    const code = data(await requestCode(phone)).devCode!;
    const parsed = await parse<{ isNewUser: boolean; isManager: boolean }>(
      await VERIFY_OTP(req("POST", "/", { phone, code })),
    );
    const body = data(parsed);
    expect(body.isNewUser).toBe(false);
    expect(body.isManager).toBe(true);
  });

  it("rejects a wrong code", async () => {
    const phone = freshPhone();
    const real = data(await requestCode(phone)).devCode!;
    const wrong = real === "000000" ? "111111" : "000000";

    const parsed = await parse(await VERIFY_OTP(req("POST", "/", { phone, code: wrong })));
    expect(parsed.status).toBe(400);
    expect(errorCode(parsed)).toBe("INVALID_BODY");
  });

  it("consumes a code, so it cannot be replayed", async () => {
    const phone = freshPhone();
    const code = data(await requestCode(phone)).devCode!;

    const first = await parse(await VERIFY_OTP(req("POST", "/", { phone, code })));
    expect(first.status).toBe(200);

    const replay = await parse(await VERIFY_OTP(req("POST", "/", { phone, code })));
    expect(replay.status).toBe(400);
  });

  it("locks out after five wrong attempts", async () => {
    const phone = freshPhone();
    const real = data(await requestCode(phone)).devCode!;
    const wrong = real === "000000" ? "111111" : "000000";

    for (let i = 0; i < 5; i += 1) {
      await VERIFY_OTP(req("POST", "/", { phone, code: wrong }));
    }
    const parsed = await parse(await VERIFY_OTP(req("POST", "/", { phone, code: real })));
    expect(parsed.status).toBe(429);
    expect(errorCode(parsed)).toBe("RATE_LIMITED");
  });

  it("rejects a code that is not six digits", async () => {
    const parsed = await parse(
      await VERIFY_OTP(req("POST", "/", { phone: freshPhone(), code: "12" })),
    );
    expect(parsed.status).toBe(400);
  });
});

describeApi("workspace slugs", () => {
  it("are URL-safe, fixed-length and unguessable", () => {
    const slugs = Array.from({ length: 200 }, () => randomSlug());
    for (const slug of slugs) expect(slug).toMatch(/^[a-z2-9]{12}$/);
    // Name-derived slugs collapsed every Persian workspace to workspace-2,
    // workspace-3 …; these must not repeat.
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
