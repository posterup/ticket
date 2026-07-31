/**
 * Connecting a published venue layout to a showing.
 *
 * This is the seam between the two halves of the feature. Our operations team
 * designs a venue once; an organiser then points one of their showings at a
 * published version of it and says what each section costs.
 *
 * Until this existed the two halves were unreachable from each other — a layout
 * could be designed and published, an event could be created, and nothing but
 * the seed script could join them.
 *
 * Organisers, not staff: they cannot edit a layout, only choose one and price
 * it. The guard is `event:edit` on their own event.
 */

import { db } from "@/lib/server/db";
import { HttpError, notFound } from "@/lib/server/http";

export interface LayoutOption {
  versionId: string;
  version: number;
  venueName: string;
  totalSeats: number;
  publishedAt: string;
  sections: { key: string; name: string; kind: string; capacity: number }[];
}

/**
 * Published layouts an organiser may attach to this event.
 *
 * Scoped to the event's own venue: a seat map for a different building would
 * sell seats that do not exist where the audience is standing.
 */
export async function layoutOptions(eventId: string): Promise<LayoutOption[]> {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { venueId: true },
  });
  if (!event) throw notFound("رویداد یافت نشد.");

  const layout = await db.venueLayout.findUnique({
    where: { venueId: event.venueId },
    select: {
      publishedVersionId: true,
      venue: { select: { name: true } },
      versions: {
        orderBy: { version: "desc" },
        select: {
          id: true,
          version: true,
          totalSeats: true,
          publishedAt: true,
          sections: {
            orderBy: { displayOrder: "asc" },
            select: { key: true, name: true, kind: true, capacity: true },
          },
        },
      },
    },
  });
  if (!layout) return [];

  /**
   * Only the current published version is offered. Older ones still serve the
   * showings already pinned to them, but nothing new should adopt a superseded
   * map.
   *
   * `publishedVersionId` is a plain column, not a foreign key, so it can point
   * at a version that no longer exists. Falling back to the newest version
   * keeps a venue sellable through that; reporting "no map published" for a
   * venue that plainly has one is the worse failure.
   */
  const current =
    layout.versions.find((v) => v.id === layout.publishedVersionId) ??
    layout.versions[0];

  return layout.versions
    .filter((v) => v.id === current?.id)
    .map((v) => ({
      versionId: v.id,
      version: v.version,
      venueName: layout.venue.name,
      totalSeats: v.totalSeats,
      publishedAt: v.publishedAt.toISOString(),
      sections: v.sections.map((s) => ({
        key: s.key,
        name: s.name,
        kind: s.kind === "STANDING" ? "standing" : "seated",
        capacity: s.capacity,
      })),
    }));
}

/**
 * Point a showing at a layout version, or detach it.
 *
 * Refuses once anything has been sold: the seat printed on an issued ticket
 * must keep meaning what it meant. Detaching returns the showing to open
 * seating on `TicketType` capacity alone.
 */
export async function attachLayout(
  eventId: string,
  sessionId: string,
  layoutVersionId: string | null,
): Promise<{ sessionId: string; layoutVersionId?: string }> {
  const session = await db.eventSession.findFirst({
    where: { id: sessionId, eventId },
    select: { id: true, layoutVersionId: true },
  });
  if (!session) throw notFound("سانس پیدا نشد.");

  const [sold, held] = await Promise.all([
    db.seatStatus.count({ where: { sessionId } }),
    db.seatHold.count({ where: { sessionId } }),
  ]);
  if (sold > 0 || held > 0) {
    throw new HttpError(
      409,
      "CONFLICT",
      "برای این سانس صندلی فروخته یا رزرو شده است؛ نقشه قابل تغییر نیست.",
    );
  }

  if (layoutVersionId) {
    const event = await db.event.findUnique({
      where: { id: eventId },
      select: { venueId: true },
    });
    const version = await db.venueLayoutVersion.findUnique({
      where: { id: layoutVersionId },
      select: { layout: { select: { venueId: true } } },
    });
    if (!version) throw notFound("نسخه نقشه پیدا نشد.");
    // A map from another building would sell seats that are not there.
    if (version.layout.venueId !== event?.venueId) {
      throw new HttpError(
        400,
        "INVALID_BODY",
        "این نقشه برای سالن دیگری است.",
      );
    }
  }

  const updated = await db.eventSession.update({
    where: { id: sessionId },
    data: { layoutVersionId },
    select: { id: true, layoutVersionId: true },
  });

  // A detached showing has no sections left to price.
  if (!layoutVersionId) {
    await db.sessionSectionPricing.deleteMany({ where: { eventId } });
  }

  return {
    sessionId: updated.id,
    layoutVersionId: updated.layoutVersionId ?? undefined,
  };
}

/**
 * Say what each section costs, by naming the ticket type that prices it.
 *
 * Replaces the whole mapping rather than patching it — a partial update leaves
 * sections silently unpriced, and an unpriced section refuses every purchase
 * with an error the buyer cannot act on.
 */
export async function setSectionPricing(
  eventId: string,
  pricing: { sectionKey: string; ticketTypeId: string }[],
): Promise<{ priced: number }> {
  const session = await db.eventSession.findFirst({
    where: { eventId, layoutVersionId: { not: null } },
    select: { layoutVersionId: true },
  });
  if (!session?.layoutVersionId) {
    throw new HttpError(
      409,
      "CONFLICT",
      "ابتدا نقشه‌ای به این رویداد وصل کنید.",
    );
  }

  const [sections, types] = await Promise.all([
    db.venueSection.findMany({
      where: { versionId: session.layoutVersionId },
      select: { id: true, key: true },
    }),
    db.ticketType.findMany({ where: { eventId }, select: { id: true } }),
  ]);

  const byKey = new Map(sections.map((s) => [s.key, s.id]));
  const validType = new Set(types.map((t) => t.id));

  const rows = pricing.map((p) => {
    const sectionId = byKey.get(p.sectionKey);
    if (!sectionId) throw notFound(`بخش «${p.sectionKey}» در این نقشه نیست.`);
    if (!validType.has(p.ticketTypeId)) {
      throw new HttpError(
        400,
        "INVALID_BODY",
        "بلیت انتخاب‌شده برای این رویداد نیست.",
      );
    }
    return { eventId, sectionId, ticketTypeId: p.ticketTypeId };
  });

  await db.$transaction([
    db.sessionSectionPricing.deleteMany({ where: { eventId } }),
    ...(rows.length
      ? [db.sessionSectionPricing.createMany({ data: rows })]
      : []),
  ]);

  return { priced: rows.length };
}
