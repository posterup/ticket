import { clientIp, handler, ok, readJson } from "@/lib/server/http";
import { holdSeats, listHolds, releaseSeats } from "@/lib/server/venues/holds";
import { resolveHolderKey } from "@/lib/server/venues/holder";
import {
  holdSeatsSchema,
  releaseSeatsSchema,
} from "@/lib/server/schemas/venue-layout";

type Context = { params: Promise<{ id: string }> };

/** GET /api/sessions/:id/holds — the caller's live picks, so a reload restores them. */
export const GET = handler(async (_request: Request, { params }: Context) => {
  const { id } = await params;
  const holderKey = await resolveHolderKey();
  return ok(await listHolds(id, holderKey));
});

/**
 * POST /api/sessions/:id/holds — claim seats.
 *
 * Open to guests: seat selection happens before any sign-in, and forcing an
 * account before someone can even see whether their seats are gettable is a
 * reliable way to lose the sale.
 *
 * Partial success is normal. `acquired` and `rejected` are both returned so the
 * UI can keep what it won and re-render only what it lost.
 */
export const POST = handler(async (request: Request, { params }: Context) => {
  const { id } = await params;
  const body = await readJson(request, holdSeatsSchema);
  const holderKey = await resolveHolderKey();

  const result = await holdSeats({
    sessionId: id,
    section: body.section,
    seats: body.seats,
    holderKey,
    // The holderKey is a cookie the caller controls; the address is not.
    ip: clientIp(request),
  });
  return ok(result, 201);
});

/**
 * DELETE /api/sessions/:id/holds — give seats back.
 *
 * With no body, releases everything this holder has for the showing — what the
 * customer's "start over" does. Holds already bound to an order are untouched.
 */
export const DELETE = handler(async (request: Request, { params }: Context) => {
  const { id } = await params;

  // A DELETE with no body is the common case, so an unparseable body means
  // "release everything" rather than a 400.
  let body: { section?: string; seats?: number[] } = {};
  try {
    body = await readJson(request, releaseSeatsSchema);
  } catch {
    body = {};
  }

  const holderKey = await resolveHolderKey();
  return ok(
    await releaseSeats({
      sessionId: id,
      holderKey,
      section: body.section,
      seats: body.seats,
    }),
  );
});
