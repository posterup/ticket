import { listCampaigns, listSegments, workspaceIdBySlug } from "@/lib/server";
import { requireWorkspaceAccess } from "@/lib/server/auth/guards";
import { handler, ok } from "@/lib/server/http";

type Context = { params: Promise<{ slug: string }> };

/** GET /api/workspaces/:slug/campaigns — campaigns and the segments to target. */
export const GET = handler(async (_r: Request, { params }: Context) => {
  const { slug } = await params;
  const workspaceId = await workspaceIdBySlug(slug);
  await requireWorkspaceAccess(workspaceId, "campaigns:send");

  const [campaigns, segments] = await Promise.all([
    listCampaigns(workspaceId),
    listSegments(workspaceId),
  ]);
  return ok({ campaigns, segments, workspaceId });
});
