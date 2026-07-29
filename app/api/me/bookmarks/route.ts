import { listBookmarkedEvents } from "@/lib/server";
import { requireUser } from "@/lib/server/auth/guards";
import { handler, ok } from "@/lib/server/http";

/** GET /api/me/bookmarks — events marked going or interested. */
export const GET = handler(async () => {
  const user = await requireUser();
  return ok(await listBookmarkedEvents(user.id));
});
