import {
  addCollaborator,
  listAcceptedCollaborators,
  listCollaborators,
} from "@/lib/server";
import { requireEventAccess } from "@/lib/server/auth/guards";
import { handler, ok, readJson } from "@/lib/server/http";
import { addCollaboratorSchema } from "@/lib/server/schemas/collaborator";

type Context = { params: Promise<{ id: string }> };

/** GET /api/events/:id/collaborators — list collaborators/requests. */
export const GET = handler(async (_request: Request, { params }: Context) => {
  const { id } = await params;
  const { grant } = await requireEventAccess(id, "event:read");

  // A pending invite carries the invitee's raw phone or username in `sub`, and
  // `event:read` is granted to anyone for a published event — so only someone
  // who manages collaborators sees anything but the accepted ones.
  return ok(
    grant.permissions.has("collaborators:manage")
      ? await listCollaborators(id)
      : await listAcceptedCollaborators(id),
  );
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
