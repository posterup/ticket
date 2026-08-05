import { clientIp, handler, ok, readJson } from "@/lib/server/http";
import { findBestAvailable } from "@/lib/server/venues/best-available";
import { resolveHolderKey } from "@/lib/server/venues/holder";
import { bestAvailableSchema } from "@/lib/server/schemas/venue-layout";

type Context = { params: Promise<{ id: string }> };

/**
 * POST /api/sessions/:id/best-available — let the server choose the seats.
 *
 * POST rather than GET because this *takes* the seats. A recommendation the
 * buyer then has to go and claim is a recommendation that can be gone by the
 * time they act on it.
 *
 * Open to guests for the same reason holds are: making someone sign in before
 * they can find out whether four seats together even exist loses the sale.
 */
export const POST = handler(async (request: Request, { params }: Context) => {
  const { id } = await params;
  const body = await readJson(request, bestAvailableSchema);
  const holderKey = await resolveHolderKey();

  return ok(
    await findBestAvailable({
      sessionId: id,
      quantity: body.quantity,
      sectionKey: body.section,
      maxPrice: body.maxPrice,
      accessible: body.accessible,
      holderKey,
      ip: clientIp(request),
    }),
    201,
  );
});
