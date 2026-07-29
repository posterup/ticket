import { getViewerState, setBookmark } from "@/lib/server";
import { requireUser } from "@/lib/server/auth/guards";
import { handler, notFound, ok, readJson } from "@/lib/server/http";
import { bookmarkSchema } from "@/lib/server/schemas/engagement";

type Context = { params: Promise<{ id: string }> };

/**
 * PUT /api/events/:id/bookmark — set «می‌روم» / «علاقه‌مندم», or clear it.
 *
 * A PUT of the desired state rather than a toggle, so a double-tap or a retry
 * converges instead of flip-flopping.
 */
export const PUT = handler(async (request: Request, { params }: Context) => {
  const { id } = await params;
  const { state } = await readJson(request, bookmarkSchema);
  const user = await requireUser();

  if (!(await setBookmark(user.id, id, state))) {
    throw notFound("رویداد یافت نشد.");
  }
  return ok(await getViewerState(user.id, id));
});
