import { requirePlatformAdmin } from "@/lib/server/auth/guards";
import { handler, ok } from "@/lib/server/http";
import { listLayouts } from "@/lib/server/venues/layouts";

/**
 * GET /api/admin/venues — every venue and the state of its seat map.
 *
 * Internal staff only. Customers never design venues: our operations team
 * builds each template once and organisers reuse it.
 */
export const GET = handler(async () => {
  await requirePlatformAdmin();
  return ok(await listLayouts());
});
