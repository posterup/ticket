import { requestWithdrawal , workspaceIdBySlug } from "@/lib/server";
import { requireWorkspaceAccess } from "@/lib/server/auth/guards";
import { handler, HttpError, notFound, ok, readJson } from "@/lib/server/http";
import { withdrawalSchema } from "@/lib/server/schemas/finance";

type Context = { params: Promise<{ slug: string }> };

/**
 * POST /api/workspaces/:slug/withdrawals — request a payout.
 *
 * Owner-only, and never reachable through an event: this is the one action
 * that moves money out.
 */
export const POST = handler(async (request: Request, { params }: Context) => {
  const { slug } = await params;
  const input = await readJson(request, withdrawalSchema);

  const workspaceId = await workspaceIdBySlug(slug);
  const { user } = await requireWorkspaceAccess(workspaceId, "finance:withdraw");

  const result = await requestWithdrawal(workspaceId, input, user.id);
  if (!result.ok) {
    if (result.reason === "no-account") throw notFound(result.message);
    throw new HttpError(409, "CONFLICT", result.message);
  }
  return ok(result, 201);
});
