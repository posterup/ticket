/**
 * The customer read path.
 *
 * Split along the seam that makes this scale: geometry is immutable and
 * addressed by layout version, so it is cacheable forever; availability is
 * volatile and travels separately as a few hundred bytes of indices.
 *
 * Nothing here ever returns seat geometry and seat availability in one
 * response. Resist the convenience — merging them makes the geometry
 * uncacheable and puts a 400 KB artifact behind a five-second TTL.
 */

import { db } from "@/lib/server/db";
import { notFound } from "@/lib/server/http";
import { DIRECT_RENDER_THRESHOLD } from "@/lib/venues/spec";
import { SECTION_KIND_FROM_DB } from "@/lib/server/mappers/enums";
import type {
  AvailabilityIndicator,
  SectionSeats,
  SectionShape,
  SectionStatus,
  SessionAvailabilitySnapshot,
  StageSpec,
  VenueOverview,
} from "@/types";

/**
 * Section shapes and names — the orientation payload.
 *
 * Immutable for a given version id, which is why the route can hand it a
 * one-year `immutable` cache header.
 */
export async function getOverview(versionId: string): Promise<VenueOverview> {
  const version = await db.venueLayoutVersion.findUnique({
    where: { id: versionId },
    include: {
      layout: { include: { venue: { select: { name: true } } } },
      sections: { orderBy: { displayOrder: "asc" } },
    },
  });
  if (!version) throw notFound("نقشه سالن پیدا نشد.");

  const spec = version.spec as { stage?: StageSpec };

  return {
    versionId: version.id,
    venueName: version.layout.venue.name,
    bounds: { width: version.width, height: version.height },
    stage: spec?.stage,
    sections: version.sections.map((s) => ({
      key: s.key,
      name: s.name,
      kind: SECTION_KIND_FROM_DB[s.kind],
      shape: s.shape as unknown as SectionShape,
      color: s.color,
      tier: s.tier,
      labelAt: [s.labelX, s.labelY],
      capacity: s.capacity,
    })),
    totalSeats: version.totalSeats,
    directRenderThreshold: DIRECT_RENDER_THRESHOLD,
  };
}

/**
 * One section's seat geometry, straight from the blob compiled at publish.
 *
 * Deliberately does not join `VenueSeat`: reading 5,000 rows to draw them would
 * undo the entire point of compiling the blob.
 */
export async function getSectionSeats(
  versionId: string,
  key: string,
): Promise<SectionSeats> {
  const section = await db.venueSection.findUnique({
    where: { versionId_key: { versionId, key } },
    select: { seatBlob: true, key: true },
  });
  if (!section?.seatBlob) throw notFound("بخش پیدا نشد.");
  return section.seatBlob as unknown as SectionSeats;
}

function indicatorFor(available: number, capacity: number): AvailabilityIndicator {
  if (available <= 0) return "sold-out";
  if (capacity <= 0) return "sold-out";
  const ratio = available / capacity;
  if (ratio <= 0.05) return "almost-full";
  if (ratio <= 0.25) return "limited";
  return "available";
}

/**
 * Per-section availability for one showing.
 *
 * Counts are derived by subtraction — capacity minus the sparse sold/held rows
 * — so the query cost tracks *sales*, not capacity. An empty 50,000-seat arena
 * costs two index scans that return nothing.
 *
 * These numbers are advisory and the UI is expected to say so. Under a real
 * on-sale they are stale the moment they are serialised; the hold is the only
 * authority on whether a seat is actually gettable.
 */
export async function getAvailability(
  sessionId: string,
): Promise<SessionAvailabilitySnapshot> {
  const session = await db.eventSession.findUnique({
    where: { id: sessionId },
    select: { id: true, eventId: true, layoutVersionId: true },
  });
  if (!session?.layoutVersionId) throw notFound("این سانس نقشه صندلی ندارد.");

  const sections = await db.venueSection.findMany({
    where: { versionId: session.layoutVersionId },
    orderBy: { displayOrder: "asc" },
    select: { id: true, key: true, capacity: true },
  });

  const [taken, holds, houseBySection, pricing] = await Promise.all([
    db.seatStatus.findMany({
      where: { sessionId },
      select: { seat: { select: { sectionId: true } } },
    }),
    db.seatHold.findMany({
      where: { sessionId, expiresAt: { gt: new Date() } },
      select: { seat: { select: { sectionId: true } } },
    }),
    // Subtracted from every section's capacity: house seats were inflating
    // the "seats available" a customer sees by the venue's own allocation.
    db.venueSeat.groupBy({
      by: ["sectionId"],
      where: { sectionId: { in: sections.map((s) => s.id) }, kind: "HOUSE" },
      _count: { _all: true },
    }),
    db.sessionSectionPricing.findMany({
      where: { eventId: session.eventId },
      select: {
        sectionId: true,
        ticketTypeId: true,
        // Capacity too: the ticket type is what `createOrder` actually reserves
        // against, so it — not the section's physical size — is often what runs
        // out first.
        ticketType: {
          select: {
            price: true,
            capacity: true,
            sold: true,
            reserved: true,
          },
        },
      },
    }),
  ]);

  const used = new Map<string, number>();
  for (const row of [...taken, ...holds]) {
    const id = row.seat.sectionId;
    used.set(id, (used.get(id) ?? 0) + 1);
  }
  for (const row of houseBySection) {
    used.set(row.sectionId, (used.get(row.sectionId) ?? 0) + row._count._all);
  }
  const priceBySection = new Map(pricing.map((p) => [p.sectionId, p]));

  return {
    sessionId,
    sections: sections.map((s) => {
      const price = priceBySection.get(s.id);

      /**
       * Two ceilings, and the lower one wins.
       *
       * The section's own capacity minus what is sold or held is the *physical*
       * limit, and for a seated section the sparse seat rows make it exact. But
       * every line — seated or standing — is reserved against the `TicketType`
       * in `createOrder`, so the allocation the organiser put on sale is just
       * as real a bound and is frequently the smaller one.
       *
       * Reporting only the first was badly wrong for standing sections, which
       * have no seat rows at all: `used` was always zero, so a 3,000-capacity
       * floor advertised 3,000 places while its ticket type had 140 left. The
       * buyer picked ten, filled in the form, and met `SOLD_OUT` at submit.
       *
       * Several sections may share one ticket type. Each is capped by the same
       * remainder rather than given a slice of it: "you could buy up to 140
       * here" is true of each of them, and any split would be a guess.
       */
      const physical = Math.max(0, s.capacity - (used.get(s.id) ?? 0));
      const allocated = price
        ? Math.max(
            0,
            price.ticketType.capacity -
              price.ticketType.sold -
              price.ticketType.reserved,
          )
        : physical;
      const available = Math.min(physical, allocated);

      return {
        key: s.key,
        available,
        // Graded against the same ceiling that produced the number, or a
        // section whose ticket type is nearly gone reads as wide open.
        indicator: indicatorFor(available, Math.min(s.capacity, price ? price.ticketType.capacity : s.capacity)),
        priceFrom: price?.ticketType.price,
        ticketTypeId: price?.ticketTypeId,
      };
    }),
    asOf: new Date().toISOString(),
  };
}

/**
 * Sold and held seats for one section, as section-local indices.
 *
 * Sparse by construction: an index that appears in neither array is available.
 * A section with nothing sold returns two empty arrays.
 */
export async function getSectionStatus(
  sessionId: string,
  key: string,
): Promise<SectionStatus> {
  const session = await db.eventSession.findUnique({
    where: { id: sessionId },
    select: { layoutVersionId: true },
  });
  if (!session?.layoutVersionId) throw notFound("این سانس نقشه صندلی ندارد.");

  const section = await db.venueSection.findUnique({
    where: { versionId_key: { versionId: session.layoutVersionId, key } },
    select: { id: true },
  });
  if (!section) throw notFound("بخش پیدا نشد.");

  const [sold, held, house] = await Promise.all([
    db.seatStatus.findMany({
      where: { sessionId, seat: { sectionId: section.id } },
      select: { seat: { select: { index: true } } },
    }),
    db.seatHold.findMany({
      where: {
        sessionId,
        expiresAt: { gt: new Date() },
        seat: { sectionId: section.id },
      },
      select: { seat: { select: { index: true } } },
    }),
    // A property of the layout, not of this showing — the same seats are held
    // back for every performance.
    db.venueSeat.findMany({
      where: { sectionId: section.id, kind: "HOUSE" },
      select: { index: true },
    }),
  ]);

  return {
    key,
    sold: sold.map((r) => r.seat.index).sort((a, b) => a - b),
    held: held.map((r) => r.seat.index).sort((a, b) => a - b),
    blocked: house.map((r) => r.index).sort((a, b) => a - b),
    asOf: new Date().toISOString(),
  };
}
