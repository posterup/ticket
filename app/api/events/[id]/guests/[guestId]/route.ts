import { removeGuest, setGuestStatus } from "@/lib/server";
import { requireEventAccess } from "@/lib/server/auth/guards";
import { handler, notFound, ok, readJson } from "@/lib/server/http";
import { guestStatusSchema } from "@/lib/server/schemas/guest";

type Context = { params: Promise<{ id: string; guestId: string }> };

/** PATCH /api/events/:id/guests/:guestId — set RSVP status. */
export const PATCH = handler(async (request: Request, { params }: Context) => {
  const { id, guestId } = await params;
  const { status } = await readJson(request, guestStatusSchema);
  await requireEventAccess(id, "guests:manage");

  const guest = await setGuestStatus(guestId, status);
  if (guest === undefined) throw notFound("Guest not found.");
  return ok(guest);
});

/** DELETE /api/events/:id/guests/:guestId — remove a guest. */
export const DELETE = handler(
  async (_request: Request, { params }: Context) => {
    const { id, guestId } = await params;
    await requireEventAccess(id, "guests:manage");
    if (!(await removeGuest(guestId))) throw notFound("Guest not found.");
    return ok({ id: guestId });
  },
);
