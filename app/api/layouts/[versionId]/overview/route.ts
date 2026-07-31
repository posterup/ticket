import { getOverview } from "@/lib/server/venues/seatmap";
import { handler, ok } from "@/lib/server/http";

type Context = { params: Promise<{ versionId: string }> };

/**
 * GET /api/layouts/:versionId/overview — section shapes, names and the stage.
 *
 * Public and **immutable**: a layout version is frozen at publish, so the URL
 * fully identifies the payload and it can be cached for a year. That is the
 * whole reason availability is not in here — merging the two would drag a
 * permanently-cacheable artifact down to a five-second TTL.
 *
 * Carries no individual seats by construction.
 */
export const GET = handler(async (_request: Request, { params }: Context) => {
  const { versionId } = await params;
  const overview = await getOverview(versionId);

  const response = ok(overview);
  response.headers.set(
    "Cache-Control",
    "public, max-age=31536000, immutable",
  );
  return response;
});
