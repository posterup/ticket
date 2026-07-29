import { removeCollaborator } from "@/lib/server";
import { requireEventAccess } from "@/lib/server/auth/guards";
import { handler, notFound, ok } from "@/lib/server/http";

type Context = { params: Promise<{ id: string; collabId: string }> };

/** DELETE /api/events/:id/collaborators/:collabId — cancel a request. */
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
