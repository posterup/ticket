import { removeGuest, setGuestStatus } from "@/lib/server";
import { handler, notFound, ok, readJson } from "@/lib/server/http";
import { guestStatusSchema } from "@/lib/server/schemas/guest";

type Context = { params: Promise<{ guestId: string }> };

/** PATCH /api/events/:id/guests/:guestId — set RSVP status. */
export const PATCH = handler(async (request: Request, { params }: Context) => {
  const { guestId } = await params;
  const { status } = await readJson(request, guestStatusSchema);

  const guest = await setGuestStatus(guestId, status);
  if (guest === undefined) throw notFound("Guest not found.");
  return ok(guest);
});

/** DELETE /api/events/:id/guests/:guestId — remove a guest. */
export const DELETE = handler(
  async (_request: Request, { params }: Context) => {
    const { guestId } = await params;
    if (!(await removeGuest(guestId))) throw notFound("Guest not found.");
    return ok({ id: guestId });
  },
);
