/**
 * A gateway that settles without leaving the process.
 *
 * The default outside production. Its redirect URL points straight back at our
 * own callback, so the full order → pay → callback → tickets loop runs with no
 * network and no credentials — which is what makes the flow reviewable and
 * testable before the real adapter exists.
 */

import { randomBytes } from "node:crypto";

import type { PaymentGateway, RequestResult, VerifyResult } from "./gateway";

/** Authorities the caller asked to fail, so the unhappy path is reachable. */
const failing = new Set<string>();

export const mockGateway: PaymentGateway = {
  provider: "mock",

  async request(input): Promise<RequestResult> {
    const authority = `mock_${randomBytes(12).toString("hex")}`;
    // `?fail=1` on the pay call propagates here through the description.
    const shouldFail = input.description.includes("[fail]");
    if (shouldFail) failing.add(authority);

    const url = new URL(input.callbackUrl);
    url.searchParams.set("Authority", authority);
    url.searchParams.set("Status", shouldFail ? "NOK" : "OK");

    return { ok: true, authority, redirectUrl: url.toString() };
  },

  async verify({ authority }): Promise<VerifyResult> {
    if (failing.has(authority)) {
      return { ok: false, code: "-51", message: "پرداخت ناموفق بود." };
    }
    return {
      ok: true,
      refId: `mock-${authority.slice(5, 15)}`,
      alreadyVerified: false,
    };
  },
};
