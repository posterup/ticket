import { updateEvent } from "@/lib/server";
import { requireEventAccess } from "@/lib/server/auth/guards";
import { handler, ok, readJson } from "@/lib/server/http";
import { eventUpdateSchema } from "@/lib/server/schemas/event";

type Context = { params: Promise<{ id: string }> };

/**
 * GET /api/events/:id — fetch one event.
 *
 * `event:read` is granted to anyone for a published, publicly-visible event,
 * so this stays open for the public page while drafts stay private.
 */
export const GET = handler(async (_request: Request, { params }: Context) => {
  const { id } = await params;
  const { event } = await requireEventAccess(id, "event:read");
  return ok(event);
});

/** PATCH /api/events/:id — edit title/description/status/visibility/slug/schedule. */
export const PATCH = handler(async (request: Request, { params }: Context) => {
  const { id } = await params;
  const patch = await readJson(request, eventUpdateSchema);

  await requireEventAccess(id, "event:edit");
  // Publishing is a separate grant: a co-host may run an event but not decide
  // that it goes live.
  if (patch.status !== undefined) {
    await requireEventAccess(id, "event:publish");
  }

  const event = await updateEvent(id, patch);
  // requireEventAccess already 404s a missing event, so this cannot be absent.
  return ok(event!);
});
