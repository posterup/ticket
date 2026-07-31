import { getAvailability } from "@/lib/server/venues/seatmap";
import { handler, ok } from "@/lib/server/http";

type Context = { params: Promise<{ id: string }> };

/**
 * GET /api/sessions/:id/availability — per-section counts for one showing.
 *
 * The volatile half of the seat map. Kept off the edge cache and given a short
 * private TTL: these numbers are advisory, and under a real on-sale they are
 * stale the moment they serialise. The hold is the only authority on whether a
 * seat can actually be had.
 */
export const GET = handler(async (_request: Request, { params }: Context) => {
  const { id } = await params;
  const availability = await getAvailability(id);

  const response = ok(availability);
  response.headers.set("Cache-Control", "private, max-age=5, must-revalidate");
  return response;
});
