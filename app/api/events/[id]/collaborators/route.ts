import { addCollaborator, listCollaborators } from "@/lib/server";
import { handler, ok, readJson } from "@/lib/server/http";
import { addCollaboratorSchema } from "@/lib/server/schemas/collaborator";

type Context = { params: Promise<{ id: string }> };

/** GET /api/events/:id/collaborators — list collaborators/requests. */
export const GET = handler(async (_request: Request, { params }: Context) => {
  const { id } = await params;
  return ok(listCollaborators(id));
});

/** POST /api/events/:id/collaborators — send a collaboration request. */
export const POST = handler(async (request: Request, { params }: Context) => {
  const { id } = await params;
  const input = await readJson(request, addCollaboratorSchema);
  return ok(addCollaborator(id, input));
});
