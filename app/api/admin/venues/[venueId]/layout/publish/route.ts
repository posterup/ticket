import { requirePlatformAdmin } from "@/lib/server/auth/guards";
import { handler, ok } from "@/lib/server/http";
import { publishLayout } from "@/lib/server/venues/layouts";

type Context = { params: Promise<{ venueId: string }> };

/**
 * POST /api/admin/venues/:venueId/layout/publish — freeze a new version.
 *
 * Compiles the draft into concrete sections, rows and seats and writes the
 * columnar blobs customers download. Existing sessions keep the version they
 * pinned, so publishing can never rewrite the seat printed on a sold ticket —
 * that is the entire reason versions exist.
 *
 * 400s with per-section detail when the spec will not compile.
 */
export const POST = handler(async (_request: Request, { params }: Context) => {
  await requirePlatformAdmin();
  const { venueId } = await params;
  return ok(await publishLayout(venueId), 201);
});
