import { setAttendeeTags } from "@/lib/server";
import { requireWorkspaceAccess } from "@/lib/server/auth/guards";
import { db } from "@/lib/server/db";
import { handler, notFound, ok, readJson } from "@/lib/server/http";
import { attendeeTagsSchema } from "@/lib/server/schemas/attendee";

type Context = { params: Promise<{ id: string }> };

/** PATCH /api/attendees/:id — replace a contact's tags (string labels). */
export const PATCH = handler(async (request: Request, { params }: Context) => {
  const { id } = await params;
  const { tags } = await readJson(request, attendeeTagsSchema);

  // The CRM is tenant-scoped: the contact's own workspace decides.
  const contact = await db.attendee.findUnique({
    where: { id },
    select: { workspaceId: true },
  });
  if (!contact) throw notFound("Contact not found.");
  await requireWorkspaceAccess(contact.workspaceId, "attendees:write");

  const attendee = await setAttendeeTags(id, tags);
  if (attendee === undefined) throw notFound("Contact not found.");
  return ok(attendee);
});
