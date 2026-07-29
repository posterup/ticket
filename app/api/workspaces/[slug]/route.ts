import { getWorkspaceBySlug, listEventsByWorkspace } from "@/lib/server";
import { getCurrentUser } from "@/lib/server/auth/guards";
import { listFollowedSlugs } from "@/lib/server";
import { handler, notFound, ok } from "@/lib/server/http";

type Context = { params: Promise<{ slug: string }> };

/**
 * GET /api/workspaces/:slug — a public organizer page.
 *
 * Carries `following` for the viewer so the follow button is correct on first
 * render without a second round trip.
 */
export const GET = handler(async (_r: Request, { params }: Context) => {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) throw notFound("فضای کاری یافت نشد.");

  const user = await getCurrentUser();
  const following = user
    ? (await listFollowedSlugs(user.id)).includes(slug)
    : false;

  return ok({
    workspace,
    events: await listEventsByWorkspace(slug),
    following,
    signedIn: user !== null,
  });
});
