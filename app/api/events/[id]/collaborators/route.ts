import { addCollaborator, listCollaborators } from "@/lib/server";
import { requireEventAccess } from "@/lib/server/auth/guards";
import { handler, ok, readJson } from "@/lib/server/http";
import { addCollaboratorSchema } from "@/lib/server/schemas/collaborator";

type Context = { params: Promise<{ id: string }> };

/** GET /api/events/:id/collaborators — list collaborators/requests. */
export const GET = handler(async (_request: Request, { params }: Context) => {
  const { id } = await params;
  await requireEventAccess(id, "event:read");
  return ok(await listCollaborators(id));
});

/** POST /api/events/:id/collaborators — send a collaboration request. */
export const POST = handler(async (request: Request, { params }: Context) => {
  const { id } = await params;
  const input = await readJson(request, addCollaboratorSchema);
  // Owner/admin only — a co-host inviting further co-hosts would let them
  // launder their own access into new grants.
  await requireEventAccess(id, "collaborators:manage");
  return ok(await addCollaborator(id, input));
});
