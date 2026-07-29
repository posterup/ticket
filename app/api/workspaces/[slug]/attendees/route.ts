import {
  listAttendees,
  listAttendeeTags,
  listEventsByAttendee,
  minPriceByEvent,
  workspaceIdBySlug,
} from "@/lib/server";
import { requireWorkspaceAccess } from "@/lib/server/auth/guards";
import { handler, ok } from "@/lib/server/http";

type Context = { params: Promise<{ slug: string }> };

/**
 * GET /api/workspaces/:slug/attendees — the workspace's CRM contacts.
 *
 * Each contact carries the events they have joined and what they have spent,
 * because the contacts table shows both and would otherwise need a request per
 * row.
 */
export const GET = handler(async (_r: Request, { params }: Context) => {
  const { slug } = await params;
  const workspaceId = await workspaceIdBySlug(slug);
  await requireWorkspaceAccess(workspaceId, "attendees:read");

  const attendees = await listAttendees(workspaceId);
  const joined = new Map(
    await Promise.all(
      attendees.map(
        async (a) => [a.id, await listEventsByAttendee(a.id)] as const,
      ),
    ),
  );
  const prices = await minPriceByEvent(
    [...joined.values()].flat().map((e) => e.id),
  );

  return ok({
    attendees: attendees.map((a) => ({
      contact: a,
      events: (joined.get(a.id) ?? []).map((e) => ({
        id: e.id,
        title: e.title,
        startAt: e.sessions[0]?.startAt ?? null,
      })),
      spent: (joined.get(a.id) ?? []).reduce(
        (sum, e) => sum + (prices.get(e.id) ?? 0),
        0,
      ),
    })),
    tags: await listAttendeeTags(workspaceId),
  });
});
