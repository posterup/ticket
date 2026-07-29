import { addBankAccount , workspaceIdBySlug } from "@/lib/server";
import { requireWorkspaceAccess } from "@/lib/server/auth/guards";
import { handler, ok, readJson } from "@/lib/server/http";
import { bankAccountSchema } from "@/lib/server/schemas/finance";

type Context = { params: Promise<{ slug: string }> };

/**
 * POST /api/workspaces/:slug/bank-accounts — save a payout destination.
 *
 * Guarded on `finance:withdraw`, not `finance:read`: adding a destination is
 * how money leaves, so it belongs with the owner rather than anyone who can
 * see the balance.
 */
export const POST = handler(async (request: Request, { params }: Context) => {
  const { slug } = await params;
  const input = await readJson(request, bankAccountSchema);

  const workspaceId = await workspaceIdBySlug(slug);
  await requireWorkspaceAccess(workspaceId, "finance:withdraw");

  return ok(await addBankAccount(workspaceId, input), 201);
});
