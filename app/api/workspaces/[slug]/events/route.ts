import { listEventsByWorkspaceId, workspaceIdBySlug } from "@/lib/server";
import { requireWorkspaceAccess } from "@/lib/server/auth/guards";
import { handler, ok } from "@/lib/server/http";

type Context = { params: Promise<{ slug: string }> };

/**
 * GET /api/workspaces/:slug/events — every event the workspace owns, drafts
 * included.
 *
 * The dashboard's list. Distinct from `GET /api/events`, which is the public
 * catalogue and hides anything unpublished.
 */
export const GET = handler(async (_r: Request, { params }: Context) => {
  const { slug } = await params;
  const workspaceId = await workspaceIdBySlug(slug);
  await requireWorkspaceAccess(workspaceId, "workspace:read");

  return ok(await listEventsByWorkspaceId(workspaceId));
});
