import {
  getEventById,
  getWorkspaceByEvent,
  listAttendeeTags,
  listCheckedTicketIds,
  listCollaborators,
  listDiscounts,
  listGuests,
  listHolders,
  listRegistrations,
  listTickets,
  listWorkspaces,
} from "@/lib/server";
import { requireEventAccess } from "@/lib/server/auth/guards";
import { handler, notFound, ok } from "@/lib/server/http";
import { formatJalaliDate, formatTime } from "@/lib/format";

type Context = { params: Promise<{ id: string }> };

/**
 * GET /api/events/:id/dashboard — everything the manage-event page renders.
 *
 * Ten reads behind one request. Split up, the page would fire ten requests
 * from the browser and paint its tabs in whatever order they returned.
 */
export const GET = handler(async (_r: Request, { params }: Context) => {
  const { id } = await params;
  // NOT `event:read` — that is granted to anyone for a published event, which
  // would hand this composite's guest phone numbers, registration details and
  // discount codes to the public. This is the manage-event page.
  const { grant } = await requireEventAccess(id, "event:edit");

  const event = await getEventById(id);
  if (!event) throw notFound("رویداد یافت نشد.");

  const sessions = event.sessions.map((s) => ({
    id: s.id,
    label: `${formatJalaliDate(s.startAt)} · ${formatTime(s.startAt)}`,
  }));
  const owner = await getWorkspaceByEvent(id);

  const [tickets, discounts, guests, collaborators, registrations, holders, checked, workspaces, tags] =
    await Promise.all([
      listTickets(id),
      listDiscounts(id),
      grant.permissions.has("guests:manage")
        ? listGuests(id)
        : Promise.resolve([]),
      listCollaborators(id),
      // Applicant names and phones: only for callers allowed to see them, and
      // only for approval-gated events.
      event.requiresApproval && grant.permissions.has("registrations:read")
        ? listRegistrations(id)
        : Promise.resolve([]),
      listHolders(id, new Map(sessions.map((s) => [s.id, s.label]))),
      listCheckedTicketIds(id),
      listWorkspaces(),
      owner ? listAttendeeTags(owner.id) : Promise.resolve([]),
    ]);

  return ok({
    event,
    sessions,
    tickets,
    discounts,
    guests,
    collaborators,
    registrations,
    holders,
    checked,
    audienceTags: tags,
    // Everyone except the owner — you invite other workspaces to collaborate.
    collabWorkspaces: workspaces
      .filter((w) => w.slug !== owner?.slug)
      .map((w) => ({ slug: w.slug, name: w.name, avatar: w.avatar })),
  });
});
