import { setCheckin } from "@/lib/server";
import { handler, ok, readJson } from "@/lib/server/http";
import { checkinSchema } from "@/lib/server/schemas/checkin";

/** POST /api/checkin — record or clear a holder's check-in. */
export const POST = handler(async (request: Request) => {
  const { holderId, checked } = await readJson(request, checkinSchema);
  setCheckin(holderId, checked);
  return ok({ holderId, checked });
});
