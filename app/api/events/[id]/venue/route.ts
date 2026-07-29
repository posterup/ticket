import { updateVenue } from "@/lib/server";
import { requireEventAccess } from "@/lib/server/auth/guards";
import { handler, notFound, ok, readJson } from "@/lib/server/http";
import { venueUpdateSchema } from "@/lib/server/schemas/event";

type Context = { params: Promise<{ id: string }> };

/** PATCH /api/events/:id/venue — edit the event's location fields. */
export const PATCH = handler(async (request: Request, { params }: Context) => {
  const { id } = await params;
  const patch = await readJson(request, venueUpdateSchema);
  await requireEventAccess(id, "event:edit");

  const venue = await updateVenue(id, patch);
  if (venue === undefined) throw notFound(`Event "${id}" was not found.`);
  return ok(venue);
});
