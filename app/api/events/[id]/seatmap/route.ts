import { requireEventAccess } from "@/lib/server/auth/guards";
import { handler, ok, readJson } from "@/lib/server/http";
import {
  attachLayout,
  layoutOptions,
  setSectionPricing,
} from "@/lib/server/venues/assign";
import { attachLayoutSchema } from "@/lib/server/schemas/venue-layout";

type Context = { params: Promise<{ id: string }> };

/**
 * GET /api/events/:id/seatmap — published layouts this event may use.
 *
 * The organiser's half of the venue feature: they cannot design a layout, only
 * adopt one our operations team published for their venue.
 */
export const GET = handler(async (_request: Request, { params }: Context) => {
  const { id } = await params;
  await requireEventAccess(id, "event:edit");
  return ok(await layoutOptions(id));
});

/**
 * PATCH /api/events/:id/seatmap — attach or detach a layout, and price it.
 *
 * Both in one call because they are one decision: a layout with unpriced
 * sections refuses every purchase, so letting them be set separately invites a
 * half-configured event going on sale.
 */
export const PATCH = handler(async (request: Request, { params }: Context) => {
  const { id } = await params;
  const body = await readJson(request, attachLayoutSchema);
  await requireEventAccess(id, "event:edit");

  const attached = await attachLayout(id, body.sessionId, body.layoutVersionId);
  const priced = body.pricing
    ? await setSectionPricing(id, body.pricing)
    : { priced: 0 };

  return ok({ ...attached, ...priced });
});
