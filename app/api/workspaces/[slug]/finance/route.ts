import { computeFinance, workspaceIdBySlug } from "@/lib/server";
import { requireWorkspaceAccess } from "@/lib/server/auth/guards";
import { handler, ok } from "@/lib/server/http";

type Context = { params: Promise<{ slug: string }> };

/** GET /api/workspaces/:slug/finance — the workspace's money. */
export const GET = handler(async (_r: Request, { params }: Context) => {
  const { slug } = await params;
  const workspaceId = await workspaceIdBySlug(slug);
  await requireWorkspaceAccess(workspaceId, "finance:read");

  return ok(await computeFinance(workspaceId));
});
