import { removeCollaborator, respondToInvite, revokeCollaborator } from "@/lib/server";
import {
  listMemberships,
  requireEventAccess,
  requireUser,
} from "@/lib/server/auth/guards";
import { handler, HttpError, notFound, ok, readJson } from "@/lib/server/http";
import { respondInviteSchema } from "@/lib/server/schemas/collaborator";

type Context = { params: Promise<{ id: string; collabId: string }> };

/**
 * PATCH /api/events/:id/collaborators/:collabId — answer or withdraw.
 *
 * Two different callers, deliberately on one route: the invitee accepts or
 * declines, and the organiser revokes. They are told apart by who is asking,
 * not by a flag in the body — a caller must not be able to name themselves as
 * the invitee.
 */
export const PATCH = handler(async (request: Request, { params }: Context) => {
  const { id, collabId } = await params;
  const { action } = await readJson(request, respondInviteSchema);
  const user = await requireUser();

  if (action === "revoke") {
    // Withdrawing someone else's access is an organiser action.
    await requireEventAccess(id, "collaborators:manage");
    const revoked = await revokeCollaborator(collabId);
    if (!revoked) throw notFound("دعوت یافت نشد.");
    return ok(revoked);
  }

  const memberships = await listMemberships(user.id);
  const result = await respondToInvite(
    collabId,
    {
      userId: user.id,
      workspaceIds: memberships.map((m) => m.workspaceId),
      phone: user.phone,
    },
    action === "accept",
  );

  if (!result.ok) {
    if (result.reason === "not-found") throw notFound(result.message);
    const status = result.reason === "not-yours" ? 403 : 409;
    throw new HttpError(
      status,
      result.reason === "not-yours" ? "FORBIDDEN" : "CONFLICT",
      result.message,
    );
  }
  return ok(result.collaborator);
});

/** DELETE /api/events/:id/collaborators/:collabId — remove the record entirely. */
export const DELETE = handler(
  async (_request: Request, { params }: Context) => {
    const { id, collabId } = await params;
    await requireEventAccess(id, "collaborators:manage");
    if (!(await removeCollaborator(collabId))) {
      throw notFound("Collaborator not found.");
    }
    return ok({ id: collabId });
  },
);
