import { listFeedEvents } from "@/lib/server";
import { requireUser } from "@/lib/server/auth/guards";
import { handler, ok } from "@/lib/server/http";

/**
 * GET /api/me/feed — published events from the workspaces this user follows.
 *
 * Scoped in the query, rather than shipping every event to the browser and
 * filtering there as the localStorage version did.
 */
export const GET = handler(async () => {
  const user = await requireUser();
  return ok(await listFeedEvents(user.id));
});
