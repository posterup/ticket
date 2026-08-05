import {
  removeBankAccount,
  setDefaultBankAccount,
  workspaceIdBySlug,
} from "@/lib/server";
import { requireWorkspaceAccess } from "@/lib/server/auth/guards";
import { handler, HttpError, notFound, ok } from "@/lib/server/http";

type Context = { params: Promise<{ slug: string; accountId: string }> };

/**
 * DELETE /api/workspaces/:slug/bank-accounts/:accountId
 *
 * `finance:withdraw`, like adding one: the set of places money can go is the
 * owner's business. Refused once the account has been paid to — a withdrawal
 * record names its destination, and removing that would orphan the trail.
 */
export const DELETE = handler(async (_r: Request, { params }: Context) => {
  const { slug, accountId } = await params;
  const workspaceId = await workspaceIdBySlug(slug);
  await requireWorkspaceAccess(workspaceId, "finance:withdraw");

  const result = await removeBankAccount(workspaceId, accountId);
  if (!result.removed) {
    throw new HttpError(409, "CONFLICT", result.reason ?? "حذف ممکن نشد.");
  }
  return ok(result);
});

/** PATCH — make this the account the withdrawal sheet pre-selects. */
export const PATCH = handler(async (_r: Request, { params }: Context) => {
  const { slug, accountId } = await params;
  const workspaceId = await workspaceIdBySlug(slug);
  await requireWorkspaceAccess(workspaceId, "finance:withdraw");

  const result = await setDefaultBankAccount(workspaceId, accountId);
  if (!result.ok) throw notFound("حساب پیدا نشد.");
  return ok(result);
});
