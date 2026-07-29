import { removeCollaborator } from "@/lib/server";
import { handler, notFound, ok } from "@/lib/server/http";

type Context = { params: Promise<{ collabId: string }> };

/** DELETE /api/events/:id/collaborators/:collabId — cancel a request. */
export const DELETE = handler(
  async (_request: Request, { params }: Context) => {
    const { collabId } = await params;
    if (!removeCollaborator(collabId)) throw notFound("Collaborator not found.");
    return ok({ id: collabId });
  },
);
