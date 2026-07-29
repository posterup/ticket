import { setAttendeeTags } from "@/lib/server";
import { handler, notFound, ok, readJson } from "@/lib/server/http";
import { attendeeTagsSchema } from "@/lib/server/schemas/attendee";

type Context = { params: Promise<{ id: string }> };

/** PATCH /api/attendees/:id — replace a contact's tags (string labels). */
export const PATCH = handler(async (request: Request, { params }: Context) => {
  const { id } = await params;
  const { tags } = await readJson(request, attendeeTagsSchema);

  const attendee = await setAttendeeTags(id, tags);
  if (attendee === undefined) throw notFound("Contact not found.");
  return ok(attendee);
});
