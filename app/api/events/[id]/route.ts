import { getEventById, updateEvent } from "@/lib/server";
import { handler, notFound, ok, readJson } from "@/lib/server/http";
import { eventUpdateSchema } from "@/lib/server/schemas/event";

type Context = { params: Promise<{ id: string }> };

/** GET /api/events/:id — fetch one event. 404 when it does not exist. */
export const GET = handler(async (_request: Request, { params }: Context) => {
  const { id } = await params;
  const event = getEventById(id);
  if (event === undefined) throw notFound(`Event "${id}" was not found.`);
  return ok(event);
});

/** PATCH /api/events/:id — edit title/description/status/visibility/slug/schedule. */
export const PATCH = handler(async (request: Request, { params }: Context) => {
  const { id } = await params;
  const patch = await readJson(request, eventUpdateSchema);

  const event = updateEvent(id, patch);
  if (event === undefined) throw notFound(`Event "${id}" was not found.`);
  return ok(event);
});
