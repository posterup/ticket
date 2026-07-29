import { listFollowedWorkspaces } from "@/lib/server";
import { requireUser } from "@/lib/server/auth/guards";
import { handler, ok } from "@/lib/server/http";

/** GET /api/me/following — the pages this user follows. */
export const GET = handler(async () => {
  const user = await requireUser();
  return ok(await listFollowedWorkspaces(user.id));
});
