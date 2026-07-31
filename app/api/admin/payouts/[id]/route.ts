import { z } from "zod";

import { handler, ok, readJson } from "@/lib/server/http";
import { requirePlatformAdmin } from "@/lib/server/auth/guards";
import { settleWithdrawal } from "@/lib/server/finance";

type Context = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  status: z.enum(["processing", "paid", "failed"]),
});

/**
 * PATCH /api/admin/payouts/:id — advance a payout.
 *
 * `pending` is not an accepted target: nothing moves *back* into the queue, and
 * the transition table in `settleWithdrawal` refuses it anyway. Rejecting it at
 * the schema keeps the error a 400 about the request rather than a 409 about
 * the world.
 */
export const PATCH = handler(async (request: Request, { params }: Context) => {
  await requirePlatformAdmin();
  const { id } = await params;
  const { status } = await readJson(request, bodySchema);
  return ok(await settleWithdrawal(id, status));
});
