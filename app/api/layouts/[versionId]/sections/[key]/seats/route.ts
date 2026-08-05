import { getSectionSeats } from "@/lib/server/venues/seatmap";
import { handler, ok } from "@/lib/server/http";

type Context = { params: Promise<{ versionId: string; key: string }> };

/**
 * GET /api/layouts/:versionId/sections/:key/seats — one section's geometry.
 *
 * The only endpoint that returns individual seats, and it is fetched lazily,
 * once a customer has actually chosen a section. Columnar (parallel arrays) so
 * a 5,000-seat section is roughly half the bytes of an array of objects before
 * compression.
 *
 * Immutable for the same reason as the overview: the version id pins it.
 */
export const GET = handler(async (_request: Request, { params }: Context) => {
  const { versionId, key } = await params;
  const seats = await getSectionSeats(versionId, key);

  const response = ok(seats);
  response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return response;
});
