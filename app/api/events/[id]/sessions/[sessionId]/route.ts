import { updateSession } from "@/lib/server";
import { requireEventAccess } from "@/lib/server/auth/guards";
import { handler, notFound, ok, readJson } from "@/lib/server/http";
import { sessionUpdateSchema } from "@/lib/server/schemas/event";

type Context = { params: Promise<{ id: string; sessionId: string }> };

/**
 * PATCH /api/events/:id/sessions/:sessionId — reschedule a سانس (startAt/endAt)
 * or cancel/restore it (`cancelled`). Any subset of fields may be sent.
 */
export const PATCH = handler(async (request: Request, { params }: Context) => {
  const { id, sessionId } = await params;
  const patch = await readJson(request, sessionUpdateSchema);
  await requireEventAccess(id, "event:edit");

  const session = await updateSession(id, sessionId, patch);
  if (session === undefined) throw notFound("Session was not found.");
  return ok(session);
});
