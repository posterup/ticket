import { setCheckinByToken } from "@/lib/server";
import { requireEventAccess } from "@/lib/server/auth/guards";
import { handler, HttpError, ok, readJson } from "@/lib/server/http";
import { checkinSchema } from "@/lib/server/schemas/checkin";

/**
 * POST /api/checkin — admit a ticket by its scanned code.
 *
 * The event is named explicitly rather than inferred from the ticket, so a
 * token from a different event is refused as a scan at the wrong door instead
 * of quietly admitting someone.
 */
export const POST = handler(async (request: Request) => {
  const { eventId, qrToken, checked } = await readJson(request, checkinSchema);
  const { user } = await requireEventAccess(eventId, "checkin:perform");

  const result = await setCheckinByToken(
    eventId,
    qrToken,
    checked,
    user?.id,
  );

  if (!result.ok) {
    // A duplicate is a conflict the door needs to see, not a server error.
    const status = result.reason === "not-found" ? 404 : 409;
    throw new HttpError(
      status,
      result.reason === "not-found" ? "NOT_FOUND" : "CONFLICT",
      result.message,
    );
  }

  return ok(result);
});
