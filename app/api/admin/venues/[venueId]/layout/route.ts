import { requirePlatformAdmin } from "@/lib/server/auth/guards";
import { handler, ok, readJson } from "@/lib/server/http";
import { getOrCreateLayout, saveDraft } from "@/lib/server/venues/layouts";
import { saveDraftSchema } from "@/lib/server/schemas/venue-layout";

type Context = { params: Promise<{ venueId: string }> };

/**
 * GET /api/admin/venues/:venueId/layout — the editable draft.
 *
 * Creates an empty layout on first open rather than backfilling one for every
 * venue, most of which will never have a seat map.
 */
export const GET = handler(async (_request: Request, { params }: Context) => {
  await requirePlatformAdmin();
  const { venueId } = await params;
  return ok(await getOrCreateLayout(venueId));
});

/**
 * PATCH /api/admin/venues/:venueId/layout — save the working copy.
 *
 * Cheap and frequent; nothing is compiled here. Saving a draft has no effect on
 * anything already on sale — only `publish` does.
 */
export const PATCH = handler(async (request: Request, { params }: Context) => {
  await requirePlatformAdmin();
  const { venueId } = await params;
  const { draft } = await readJson(request, saveDraftSchema);
  return ok(await saveDraft(venueId, draft));
});
