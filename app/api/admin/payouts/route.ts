import { z } from "zod";

import { handler, ok, readQuery } from "@/lib/server/http";
import { requirePlatformAdmin } from "@/lib/server/auth/guards";
import { listPayouts, type WithdrawalStatus } from "@/lib/server/finance";

const querySchema = z.object({
  status: z.enum(["pending", "processing", "paid", "failed"]).optional(),
});

/**
 * GET /api/admin/payouts — the platform-wide payout queue.
 *
 * Internal staff only. It carries every organiser's IBAN and account holder,
 * which is the whole reason it lives under `/api/admin` rather than on the
 * workspace's own finance endpoint.
 */
export const GET = handler(async (request: Request) => {
  await requirePlatformAdmin();
  const { status } = await readQuery(request, querySchema);
  return ok(await listPayouts(status as WithdrawalStatus | undefined));
});
