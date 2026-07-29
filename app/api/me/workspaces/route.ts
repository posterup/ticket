import { listWorkspacesForUser } from "@/lib/server";
import { requireActiveWorkspace } from "@/lib/server/auth/guards";
import { handler, ok } from "@/lib/server/http";

/**
 * GET /api/me/workspaces — the workspaces the caller belongs to, and which is
 * active.
 *
 * What the switcher renders. Deliberately not the platform directory: offering
 * to switch into a workspace you have no membership in is what made the old
 * switcher appear broken.
 */
export const GET = handler(async () => {
  const { user, workspace } = await requireActiveWorkspace();
  return ok({
    workspaces: await listWorkspacesForUser(user.id),
    activeWorkspaceId: workspace.workspaceId,
  });
});
