import { verifyOtp } from "@/lib/server/auth/otp";
import { createSession, setSessionCookie } from "@/lib/server/auth/session";
import { listMemberships } from "@/lib/server/auth/guards";
import { handler, HttpError, ok, readJson } from "@/lib/server/http";
import { otpVerifySchema } from "@/lib/server/schemas/auth";

/**
 * POST /api/auth/otp/verify — exchange a code for a session.
 *
 * Login and signup are the same call: `isNewUser` tells the client whether to
 * continue to organizer onboarding. `isManager` says whether the dashboard is
 * reachable, so the client need not guess where to send them.
 */
export const POST = handler(async (request: Request) => {
  const { phone, code } = await readJson(request, otpVerifySchema);

  const result = await verifyOtp(phone, code);
  if (!result.ok) {
    const status = result.code === "TOO_MANY_ATTEMPTS" ? 429 : 400;
    throw new HttpError(
      status,
      result.code === "TOO_MANY_ATTEMPTS" ? "RATE_LIMITED" : "INVALID_BODY",
      result.message,
    );
  }

  const { token, expiresAt } = await createSession(result.userId, {
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    userAgent: request.headers.get("user-agent") ?? undefined,
  });
  await setSessionCookie(token, expiresAt);

  const memberships = await listMemberships(result.userId);
  return ok({
    isNewUser: result.isNewUser,
    isManager: memberships.length > 0,
  });
});
