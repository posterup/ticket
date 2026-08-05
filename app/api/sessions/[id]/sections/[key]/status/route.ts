import { getSectionStatus } from "@/lib/server/venues/seatmap";
import { handler, ok } from "@/lib/server/http";

type Context = { params: Promise<{ id: string; key: string }> };

/**
 * GET /api/sessions/:id/sections/:key/status — sold and held seats.
 *
 * Sparse: only the section-local indices that are *not* available travel. A
 * freshly on-sale section returns two empty arrays regardless of whether it
 * seats 200 or 20,000, which is what keeps this cheap enough to poll.
 */
export const GET = handler(async (_request: Request, { params }: Context) => {
  const { id, key } = await params;
  const status = await getSectionStatus(id, key);

  const response = ok(status);
  response.headers.set("Cache-Control", "private, max-age=3, must-revalidate");
  return response;
});
