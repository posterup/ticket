import { setCheckin } from "@/lib/server";
import { requireEventAccess } from "@/lib/server/auth/guards";
import { handler, HttpError, ok, readJson } from "@/lib/server/http";
import { checkinSchema } from "@/lib/server/schemas/checkin";

/**
 * The synthetic holder ids from `lib/checkin/data.ts` are `${eventId}-h${n}`,
 * so the event they belong to is recoverable from the id itself. Once
 * checkout issues real tickets this endpoint takes a `qrToken` and looks the
 * event up properly.
 */
function eventIdFromHolder(holderId: string): string | null {
  const match = /^(.+)-h\d+$/.exec(holderId);
  return match?.[1] ?? null;
}

/** POST /api/checkin — record or clear a holder's check-in. */
export const POST = handler(async (request: Request) => {
  const { holderId, checked } = await readJson(request, checkinSchema);

  const eventId = eventIdFromHolder(holderId);
  if (!eventId) {
    throw new HttpError(400, "INVALID_BODY", "شناسه بلیت معتبر نیست.");
  }
  await requireEventAccess(eventId, "checkin:perform");

  await setCheckin(holderId, checked);
  return ok({ holderId, checked });
});
