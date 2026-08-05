import { requestOtp } from "@/lib/server/auth/otp";
import { handler, HttpError, ok, readJson } from "@/lib/server/http";
import { otpRequestSchema } from "@/lib/server/schemas/auth";

/**
 * POST /api/auth/otp/request — send a one-time code.
 *
 * The response is identical whether or not the number has an account, so it
 * cannot be used to enumerate registered users.
 */
export const POST = handler(async (request: Request) => {
  const { phone } = await readJson(request, otpRequestSchema);

  const result = await requestOtp(phone, {
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      undefined,
  });

  if (!result.ok) {
    const status = result.code === "RATE_LIMITED" ? 429 : result.code === "SMS_FAILED" ? 502 : 400;
    const code = result.code === "RATE_LIMITED" ? "RATE_LIMITED" : result.code === "SMS_FAILED" ? "SMS_FAILED" : "INVALID_BODY";
    throw new HttpError(status, code, result.message);
  }

  return ok({
    expiresInSec: result.expiresInSec,
    resendAfterSec: result.resendAfterSec,
    // Only outside production, so development needs no SMS credentials.
    ...(result.devCode ? { devCode: result.devCode } : {}),
    // How to obtain the code when no SMS was sent. Says nothing the caller
    // could not already derive from the number they just typed.
    ...(result.hint ? { hint: result.hint } : {}),
  });
});
