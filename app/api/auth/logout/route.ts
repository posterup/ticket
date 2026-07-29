import {
  clearSessionCookie,
  readSessionCookie,
  revokeSession,
} from "@/lib/server/auth/session";
import { handler, ok } from "@/lib/server/http";

/**
 * POST /api/auth/logout — revoke the session and drop the cookie.
 *
 * Idempotent: signing out twice, or without a session, still succeeds.
 */
export const POST = handler(async () => {
  const token = await readSessionCookie();
  if (token) await revokeSession(token);
  await clearSessionCookie();
  return ok({ signedOut: true });
});
