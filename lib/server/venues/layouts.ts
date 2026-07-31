/**
 * Venue layout templates: the admin side.
 *
 * A layout has an editable head (`VenueLayout.draft`) and a tail of immutable
 * published versions. Publishing compiles the draft spec into concrete
 * sections, rows and seats, and freezes a copy of the spec alongside them.
 *
 * Nothing here is reachable without `requirePlatformAdmin()` — venues are
 * designed once by our operations team, not by customers.
 */

import { db } from "@/lib/server/db";
import { HttpError, notFound } from "@/lib/server/http";
import {
  generateSection,
  sectionCapacity,
  toSectionSeats,
  totalSeats,
  validateSpec,
} from "@/lib/venues/spec";
import { centroidOf } from "@/lib/venues/geometry";
import { emptyLayoutSpec } from "@/types";
import type { LayoutSpec } from "@/types";
import { SEAT_KIND_TO_DB, SECTION_KIND_TO_DB } from "@/lib/server/mappers/enums";

export interface LayoutSummary {
  venueId: string;
  venueName: string;
  city: string;
  layoutId?: string;
  publishedVersionId?: string;
  publishedVersion?: number;
  totalSeats?: number;
  updatedAt?: string;
}

/** Every venue, with its layout state. The designer's index. */
export async function listLayouts(): Promise<LayoutSummary[]> {
  const venues = await db.venue.findMany({
    orderBy: { name: "asc" },
    include: {
      layout: { include: { versions: { orderBy: { version: "desc" }, take: 1 } } },
    },
  });

  return venues.map((venue) => {
    const layout = venue.layout;
    const latest = layout?.versions[0];
    const published =
      latest && latest.id === layout?.publishedVersionId ? latest : undefined;
    return {
      venueId: venue.id,
      venueName: venue.name,
      city: venue.city,
      layoutId: layout?.id,
      publishedVersionId: layout?.publishedVersionId ?? undefined,
      publishedVersion: published?.version,
      totalSeats: published?.totalSeats,
      updatedAt: layout?.updatedAt.toISOString(),
    };
  });
}

export interface LayoutDetail {
  layoutId: string;
  venueId: string;
  venueName: string;
  name: string;
  draft: LayoutSpec;
  publishedVersionId?: string;
  versions: { id: string; version: number; totalSeats: number; publishedAt: string }[];
}

/**
 * The layout for a venue, creating an empty draft on first open.
 *
 * Lazily created rather than backfilled for every venue: most venues in the
 * database will never get a seat map, and an empty row per venue is noise.
 */
export async function getOrCreateLayout(venueId: string): Promise<LayoutDetail> {
  const venue = await db.venue.findUnique({ where: { id: venueId } });
  if (!venue) throw notFound("سالن پیدا نشد.");

  let layout = await db.venueLayout.findUnique({
    where: { venueId },
    include: { versions: { orderBy: { version: "desc" } } },
  });

  if (!layout) {
    await db.venueLayout.create({
      data: {
        venueId,
        name: venue.name,
        draft: emptyLayoutSpec() as unknown as object,
      },
    });
    layout = await db.venueLayout.findUnique({
      where: { venueId },
      include: { versions: { orderBy: { version: "desc" } } },
    });
  }

  if (!layout) throw notFound("سالن پیدا نشد.");

  return {
    layoutId: layout.id,
    venueId: venue.id,
    venueName: venue.name,
    name: layout.name,
    draft: layout.draft as unknown as LayoutSpec,
    publishedVersionId: layout.publishedVersionId ?? undefined,
    versions: layout.versions.map((v) => ({
      id: v.id,
      version: v.version,
      totalSeats: v.totalSeats,
      publishedAt: v.publishedAt.toISOString(),
    })),
  };
}

/** Save the working copy. Cheap and frequent — no compilation happens here. */
export async function saveDraft(
  venueId: string,
  draft: LayoutSpec,
): Promise<{ savedAt: string }> {
  await getOrCreateLayout(venueId);
  const updated = await db.venueLayout.update({
    where: { venueId },
    data: { draft: draft as unknown as object },
  });
  return { savedAt: updated.updatedAt.toISOString() };
}

export interface PublishResult {
  versionId: string;
  version: number;
  totalSeats: number;
  sections: number;
}

/**
 * Compile the draft into a new immutable version.
 *
 * Seats are materialised here — once — rather than on read. A 12,000-seat arena
 * is 12,000 rows written in batches, which is slow but happens on publish, not
 * on the customer path. The columnar blob written onto each section is what
 * customers actually download; `VenueSeat` exists so holds, orders and issued
 * tickets have something with referential integrity to point at.
 */
export async function publishLayout(venueId: string): Promise<PublishResult> {
  const layout = await getOrCreateLayout(venueId);
  const spec = layout.draft;

  const problems = validateSpec(spec);
  if (problems.length) {
    throw new HttpError(
      400,
      "INVALID_BODY",
      "نقشه سالن هنوز آماده انتشار نیست.",
      problems.map((p) => ({ path: p.path, message: p.message })),
    );
  }

  const last = await db.venueLayoutVersion.findFirst({
    where: { layoutId: layout.layoutId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (last?.version ?? 0) + 1;

  const created = await db.venueLayoutVersion.create({
    data: {
      layoutId: layout.layoutId,
      version,
      spec: spec as unknown as object,
      width: spec.bounds.width,
      height: spec.bounds.height,
      totalSeats: totalSeats(spec),
    },
  });

  for (const [order, section] of spec.sections.entries()) {
    const generated = generateSection(section);
    const at = section.labelAt ?? centroidOf(section.shape);
    const labelAt = Array.isArray(at) ? at : [at.x, at.y];

    const row = await db.venueSection.create({
      data: {
        versionId: created.id,
        key: section.key,
        name: section.name,
        kind: SECTION_KIND_TO_DB[section.kind],
        shape: section.shape as unknown as object,
        color: section.color,
        labelX: labelAt[0],
        labelY: labelAt[1],
        tier: section.tier,
        capacity: sectionCapacity(section),
        seatCount: generated.seats.length,
        seatBlob: generated.seats.length
          ? (toSectionSeats(generated) as unknown as object)
          : undefined,
        displayOrder: order,
      },
    });

    if (!generated.seats.length) continue;

    const rowIds = new Map<string, string>();
    for (const r of generated.rows) {
      const createdRow = await db.venueRow.create({
        data: {
          sectionId: row.id,
          key: r.key,
          label: r.label,
          index: r.index,
          seatCount: r.seatCount,
        },
      });
      rowIds.set(r.key, createdRow.id);
    }

    // Batched: one 12k-row insert exhausts the parameter limit.
    const CHUNK = 2_000;
    for (let i = 0; i < generated.seats.length; i += CHUNK) {
      await db.venueSeat.createMany({
        data: generated.seats.slice(i, i + CHUNK).map((seat) => ({
          sectionId: row.id,
          rowId: rowIds.get(seat.rowKey) as string,
          index: seat.index,
          label: seat.label,
          x: seat.x,
          y: seat.y,
          kind: SEAT_KIND_TO_DB[seat.kind],
        })),
      });
    }
  }

  await db.venueLayout.update({
    where: { venueId },
    data: { publishedVersionId: created.id },
  });

  return {
    versionId: created.id,
    version,
    totalSeats: created.totalSeats,
    sections: spec.sections.length,
  };
}
