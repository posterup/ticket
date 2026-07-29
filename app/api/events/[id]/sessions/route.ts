import { addSession } from "@/lib/server";
import { handler, notFound, ok, readJson } from "@/lib/server/http";
import { createSessionSchema } from "@/lib/server/schemas/event";

type Context = { params: Promise<{ id: string }> };

/** POST /api/events/:id/sessions — add a new سانس (startAt/endAt). */
export const POST = handler(async (request: Request, { params }: Context) => {
  const { id } = await params;
  const input = await readJson(request, createSessionSchema);

  const session = addSession(id, input);
  if (session === undefined) throw notFound(`Event "${id}" was not found.`);
  return ok(session, 201);
});
