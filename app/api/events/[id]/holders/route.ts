import { getEventById, listCheckedTicketIds, listHolders } from "@/lib/server";
import { requireEventAccess } from "@/lib/server/auth/guards";
import { handler, ok } from "@/lib/server/http";
import { formatJalaliDate, formatTime } from "@/lib/format";

type Context = { params: Promise<{ id: string }> };

/**
 * GET /api/events/:id/holders — the door list, and who has been admitted.
 *
 * Session labels are formatted here rather than client-side so the scanner and
 * the dashboard cannot drift apart on how a سانس reads.
 */
export const GET = handler(async (_r: Request, { params }: Context) => {
  const { id } = await params;
  const { event } = await requireEventAccess(id, "checkin:perform");

  const sessions = (await getEventById(id))!.sessions.map((s) => ({
    id: s.id,
    label: `${formatJalaliDate(s.startAt)} · ${formatTime(s.startAt)}`,
  }));

  return ok({
    eventId: event.id,
    title: event.title,
    sessions,
    holders: await listHolders(id, new Map(sessions.map((s) => [s.id, s.label]))),
    checked: await listCheckedTicketIds(id),
  });
});
