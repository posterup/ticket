import {
  getViewerState,
  getWorkspaceByEvent,
  listAcceptedCollaborators,
  listTickets,
} from "@/lib/server";
import {
  getCurrentUser,
  requireEventAccess,
} from "@/lib/server/auth/guards";
import { handler, ok } from "@/lib/server/http";

type Context = { params: Promise<{ id: string }> };

/**
 * GET /api/events/:id/page-data — everything the public event page renders.
 *
 * One request rather than five, because the page needs all of it before it can
 * show anything useful, and five round trips from the browser is five chances
 * to render half a page.
 *
 * `event:read` is granted to anyone for a published, publicly-visible event,
 * so this stays open — but a draft still 401s.
 */
export const GET = handler(async (_r: Request, { params }: Context) => {
  const { id } = await params;
  const { event } = await requireEventAccess(id, "event:read");

  const [tickets, organizer, collaborators, viewer] = await Promise.all([
    listTickets(event.id),
    getWorkspaceByEvent(event.id),
    listAcceptedCollaborators(event.id),
    getCurrentUser(),
  ]);

  return ok({
    event,
    tickets,
    organizer,
    collaborators,
    signedIn: viewer !== null,
    viewerState: viewer
      ? await getViewerState(viewer.id, event.id)
      : { bookmark: null, notify: false },
  });
});
