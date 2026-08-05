import { db } from "@/lib/server/db";
import { handler, notFound, ok } from "@/lib/server/http";

type Context = { params: Promise<{ id: string }> };

/**
 * GET /api/sessions/:id — the bare facts the seat-map page needs to boot.
 *
 * Deliberately thin: which layout version this showing pinned, and enough event
 * context to render a heading. Geometry and availability are separate requests
 * with very different cache lifetimes.
 */
export const GET = handler(async (_request: Request, { params }: Context) => {
  const { id } = await params;
  const session = await db.eventSession.findUnique({
    where: { id },
    select: {
      id: true,
      startAt: true,
      cancelled: true,
      layoutVersionId: true,
      event: { select: { id: true, title: true, status: true } },
      layoutVersion: {
        select: { layout: { select: { venue: { select: { name: true } } } } },
      },
    },
  });
  if (!session) throw notFound("سانس پیدا نشد.");

  return ok({
    id: session.id,
    startAt: session.startAt.toISOString(),
    cancelled: session.cancelled,
    layoutVersionId: session.layoutVersionId ?? undefined,
    eventId: session.event.id,
    eventTitle: session.event.title,
    venueName: session.layoutVersion?.layout.venue.name,
  });
});
