import { addGuest, listGuests } from "@/lib/server";
import { handler, ok, readJson } from "@/lib/server/http";
import { addGuestSchema } from "@/lib/server/schemas/guest";

type Context = { params: Promise<{ id: string }> };

/** GET /api/events/:id/guests — list an event's guests. */
export const GET = handler(async (_request: Request, { params }: Context) => {
  const { id } = await params;
  return ok(listGuests(id));
});

/** POST /api/events/:id/guests — invite a guest to a session by phone/username. */
export const POST = handler(async (request: Request, { params }: Context) => {
  const { id } = await params;
  const input = await readJson(request, addGuestSchema);
  return ok(addGuest(id, input));
});
