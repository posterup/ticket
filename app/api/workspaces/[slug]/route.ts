import {
  getWorkspaceBySlug,
  listEventsByWorkspace,
  updateWorkspace,
} from "@/lib/server";
import {
  getCurrentUser,
  requireWorkspaceAccess,
} from "@/lib/server/auth/guards";
import { listFollowedSlugs } from "@/lib/server";
import { handler, notFound, ok, readJson } from "@/lib/server/http";
import { updateWorkspaceSchema } from "@/lib/server/schemas/workspace";

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

/**
 * PATCH /api/workspaces/:slug — edit the public profile.
 *
 * The edit form used to be a mock: it validated, set a boolean, rendered
 * «ذخیره شد» and persisted nothing. Anyone who renamed their workspace lost the
 * change on reload and had been told otherwise.
 */
export const PATCH = handler(async (request: Request, { params }: Context) => {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) throw notFound("فضای کاری یافت نشد.");

  await requireWorkspaceAccess(workspace.id, "workspace:edit");
  const patch = await readJson(request, updateWorkspaceSchema);
  return ok(await updateWorkspace(workspace.id, patch));
});
