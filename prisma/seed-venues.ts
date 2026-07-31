/**
 * Seat-map fixtures.
 *
 * Two venues, chosen to exercise both sides of the rendering threshold:
 *
 *  * **تالار وحدت** — 468 seats across four sections. Below
 *    `DIRECT_RENDER_THRESHOLD`, so the customer map renders it in one step.
 *  * **ورزشگاه آزادی** — 6,080 seats across five seated sections plus a
 *    3,000-capacity standing terrace. The stress fixture: proves publish, the
 *    columnar blobs and the canvas renderer hold up at arena scale, and that a
 *    standing section coexists with seated ones.
 *
 * Seats are materialised through the same `generateSection`/`toSectionSeats`
 * the publish endpoint uses, so what is seeded is byte-identical to what an
 * operator would produce by pressing Publish.
 *
 * Ids here are fixed and load-bearing — `tests/api/seatmap.test.ts` references
 * them by hand. Never renumber them.
 */

import type { PrismaClient } from "../generated/client";
import { generateSection, toSectionSeats, totalSeats } from "../lib/venues/spec";
import { centroidOf } from "../lib/venues/geometry";
import { SEAT_KIND_TO_DB, SECTION_KIND_TO_DB } from "../lib/server/mappers/enums";
import { DEFAULT_NUMBERING } from "../types/venue-layout";
import type { LayoutSpec, SectionSpec } from "../types/venue-layout";

export const THEATRE_VENUE = "7a2b1c3d-0001-4e5f-9a8b-1c2d3e4f5a01";
export const ARENA_VENUE = "7a2b1c3d-0002-4e5f-9a8b-1c2d3e4f5a02";

function rows(
  over: Partial<NonNullable<SectionSpec["rows"]>>,
): NonNullable<SectionSpec["rows"]> {
  return {
    count: 10,
    spacing: 30,
    seatSpacing: 26,
    origin: [600, 240],
    angle: 0,
    curve: 0,
    seatsPerRow: 20,
    numbering: DEFAULT_NUMBERING,
    ...over,
  };
}

/** A mid-size proscenium theatre: stalls, two side blocks, a balcony. */
function theatreSpec(): LayoutSpec {
  return {
    version: 1,
    bounds: { width: 1200, height: 900 },
    stage: {
      shape: { type: "rect", x: 420, y: 50, w: 360, h: 70 },
      label: "صحنه",
    },
    sections: [
      {
        key: "vip",
        name: "ویژه",
        kind: "seated",
        shape: { type: "rect", x: 430, y: 165, w: 340, h: 105 },
        color: "accent",
        tier: 1,
        rows: rows({
          count: 3,
          seatsPerRow: 12,
          origin: [600, 190],
          spacing: 32,
          seatSpacing: 27,
        }),
      },
      {
        key: "stalls",
        name: "سالن اصلی",
        kind: "seated",
        shape: { type: "rect", x: 360, y: 300, w: 480, h: 330 },
        color: "#1b6df5",
        tier: 2,
        rows: rows({
          count: 12,
          seatsPerRow: [16, 16, 18, 18, 18, 20, 20, 20, 22, 22, 22, 24],
          origin: [600, 325],
          spacing: 26,
          seatSpacing: 25,
          // Gently bowed toward the stage, as a real stalls block is.
          curve: 0.04,
        }),
        /**
         * Step-free positions at both ends of the back row (L, indices
         * 212–235), each wheelchair space paired with a companion seat beside
         * it — which is how venues actually sell them, and what the seat
         * picker's accessibility filter exists to surface.
         */
        overrides: {
          "212": { kind: "wheelchair" },
          "213": { kind: "companion" },
          "234": { kind: "companion" },
          "235": { kind: "wheelchair" },
          // Row A centre — the pair every venue keeps back for the press and
          // the producer's guests. Never sold, and excluded from the count.
          "7": { kind: "house" },
          "8": { kind: "house" },
        },
      },
      {
        key: "side-left",
        name: "جناح چپ",
        kind: "seated",
        shape: { type: "rect", x: 150, y: 310, w: 175, h: 260 },
        color: "#8553f6",
        tier: 3,
        rows: rows({
          count: 9,
          seatsPerRow: 6,
          origin: [237, 335],
          spacing: 28,
          seatSpacing: 26,
          numbering: { ...DEFAULT_NUMBERING, seatOrigin: "left" },
        }),
        // A pillar clips the view from the two seats nearest the wall. Sold,
        // but the buyer is told before they choose.
        overrides: {
          "48": { kind: "obstructed" },
          "53": { kind: "obstructed" },
        },
      },
      {
        key: "balcony",
        name: "بالکن",
        kind: "seated",
        shape: {
          type: "polygon",
          points: [
            [330, 680],
            [870, 680],
            [910, 810],
            [290, 810],
          ],
        },
        color: "#08865c",
        tier: 4,
        rows: rows({
          count: 5,
          seatsPerRow: [26, 28, 28, 30, 30],
          origin: [600, 705],
          spacing: 26,
          seatSpacing: 24,
          curve: -0.03,
        }),
      },
    ],
  };
}

/** A bowl: four stands, four corners, a floor, and a standing terrace. */
function arenaSpec(): LayoutSpec {
  const stand = (
    key: string,
    name: string,
    x: number,
    y: number,
    angle: number,
    tier: number,
    color: string,
  ): SectionSpec => ({
    key,
    name,
    kind: "seated",
    shape: { type: "rect", x: x - 260, y: y - 90, w: 520, h: 180 },
    color,
    tier,
    rows: rows({
      count: 22,
      seatsPerRow: 68,
      origin: [x, y - 70],
      spacing: 7.5,
      seatSpacing: 7.2,
      angle,
      curve: 0.02,
    }),
  });

  return {
    version: 1,
    bounds: { width: 1600, height: 1400 },
    stage: {
      shape: { type: "rect", x: 640, y: 620, w: 320, h: 170 },
      label: "زمین",
    },
    sections: [
      stand("north", "جایگاه شمالی", 800, 300, 0, 2, "#1b6df5"),
      stand("south", "جایگاه جنوبی", 800, 1100, 0, 2, "#1b6df5"),
      stand("east", "جایگاه شرقی", 1330, 700, 90, 1, "#e10d7d"),
      stand("west", "جایگاه غربی", 270, 700, 90, 1, "#e10d7d"),
      {
        key: "floor",
        name: "زمین (ایستاده)",
        kind: "standing",
        shape: { type: "rect", x: 560, y: 560, w: 480, h: 290 },
        color: "#a76607",
        tier: 1,
        capacity: 3_000,
      },
      {
        key: "vip-box",
        name: "لژ ویژه",
        kind: "seated",
        shape: { type: "rect", x: 660, y: 180, w: 280, h: 80 },
        color: "#8553f6",
        tier: 1,
        rows: rows({
          count: 4,
          seatsPerRow: 24,
          origin: [800, 200],
          spacing: 18,
          seatSpacing: 11,
        }),
      },
    ],
  };
}

interface VenueFixture {
  id: string;
  name: string;
  city: string;
  address: string;
  spec: LayoutSpec;
}

const FIXTURES: VenueFixture[] = [
  {
    id: THEATRE_VENUE,
    name: "تالار وحدت",
    city: "تهران",
    address: "خیابان حافظ، تالار وحدت",
    spec: theatreSpec(),
  },
  {
    id: ARENA_VENUE,
    name: "ورزشگاه آزادی",
    city: "تهران",
    address: "بزرگراه تهران–کرج، مجموعه ورزشی آزادی",
    spec: arenaSpec(),
  },
];

/**
 * Materialise a published version.
 *
 * Mirrors `publishLayout()` exactly rather than importing it — that function
 * reaches for `lib/server/db`, and the seed owns its own client.
 */
async function publish(
  db: PrismaClient,
  layoutId: string,
  spec: LayoutSpec,
): Promise<string> {
  const version = await db.venueLayoutVersion.create({
    data: {
      layoutId,
      version: 1,
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
        versionId: version.id,
        key: section.key,
        name: section.name,
        kind: SECTION_KIND_TO_DB[section.kind],
        shape: section.shape as unknown as object,
        color: section.color,
        labelX: labelAt[0],
        labelY: labelAt[1],
        tier: section.tier,
        capacity:
          section.kind === "standing"
            ? (section.capacity ?? 0)
            : generated.seats.length,
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
      const created = await db.venueRow.create({
        data: {
          sectionId: row.id,
          key: r.key,
          label: r.label,
          index: r.index,
          seatCount: r.seatCount,
        },
      });
      rowIds.set(r.key, created.id);
    }

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
    where: { id: layoutId },
    data: { publishedVersionId: version.id },
  });

  return version.id;
}

export async function seedVenueLayouts(db: PrismaClient): Promise<void> {
  // Idempotent: drop and rebuild, so a re-seed does not stack versions.
  await db.venueLayout.deleteMany({
    where: { venueId: { in: FIXTURES.map((f) => f.id) } },
  });

  const versionByVenue = new Map<string, string>();

  for (const fixture of FIXTURES) {
    await db.venue.upsert({
      where: { id: fixture.id },
      update: { name: fixture.name, city: fixture.city },
      create: {
        id: fixture.id,
        name: fixture.name,
        city: fixture.city,
        province: "تهران",
        address: fixture.address,
        capacity: totalSeats(fixture.spec),
      },
    });

    const layout = await db.venueLayout.create({
      data: {
        venueId: fixture.id,
        name: fixture.name,
        draft: fixture.spec as unknown as object,
      },
    });

    versionByVenue.set(fixture.id, await publish(db, layout.id, fixture.spec));
  }

  /**
   * Put the theatre map behind a real showing, so the customer path is walkable
   * straight after a seed.
   *
   * The event has to have ticket types that are **on sale right now**, not just
   * any ticket types: `createOrder` refuses a closed sales window, so attaching
   * the map to an event whose tickets have expired produces a seat map where
   * every seat is selectable and no seat is buyable. The seeded windows are
   * fixed dates, so this is resolved at seed time rather than hardcoded.
   */
  const now = new Date();
  const candidates = await db.eventSession.findMany({
    where: {
      cancelled: false,
      event: {
        status: "PUBLISHED",
        ticketTypes: {
          some: { salesStartAt: { lte: now }, salesEndAt: { gte: now } },
        },
      },
    },
    orderBy: { startAt: "asc" },
    select: {
      id: true,
      eventId: true,
      event: {
        select: {
          ticketTypes: {
            where: { salesStartAt: { lte: now }, salesEndAt: { gte: now } },
            // `capacity` so the arena is not pinned to an event whose tiers
            // cannot cover a stand — see `arenaSession` below.
            select: { id: true, capacity: true },
          },
        },
      },
    },
  });

  // Prefer the event with the most distinct on-sale tiers, so different
  // sections get genuinely different prices.
  const session = candidates.sort(
    (a, b) => b.event.ticketTypes.length - a.event.ticketTypes.length,
  )[0];

  const theatreVersion = versionByVenue.get(THEATRE_VENUE);
  const arenaVersion = versionByVenue.get(ARENA_VENUE);

  /**
   * Attach a published layout to a showing and price its sections.
   *
   * Sections are ordered by tier and paired with ticket types cheapest-last, so
   * the closest block gets the dearest tier and the rest fall through.
   */
  async function attach(sessionRow: { id: string; eventId: string }, versionId: string) {
    /**
     * Move the event into the venue whose map it is about to use.
     *
     * The seed used to write `layoutVersionId` straight onto the session,
     * leaving a concert at برج میلاد selling seats in تالار وحدت. The API
     * refuses that mismatch outright, so the fixture was in a state an
     * organiser could never have produced — and the "which layouts may I use?"
     * endpoint correctly returned nothing for it.
     */
    const version = await db.venueLayoutVersion.findUnique({
      where: { id: versionId },
      select: { layout: { select: { venueId: true } } },
    });
    if (version) {
      await db.event.update({
        where: { id: sessionRow.eventId },
        data: { venueId: version.layout.venueId },
      });
      await db.eventSession.updateMany({
        where: { eventId: sessionRow.eventId, venueId: { not: null } },
        data: { venueId: version.layout.venueId },
      });
    }

    await db.eventSession.update({
      where: { id: sessionRow.id },
      data: { layoutVersionId: versionId },
    });

    const [sections, tiers] = await Promise.all([
      db.venueSection.findMany({
        where: { versionId },
        orderBy: { tier: "asc" },
        select: { id: true },
      }),
      db.ticketType.findMany({
        where: {
          eventId: sessionRow.eventId,
          salesStartAt: { lte: now },
          salesEndAt: { gte: now },
        },
        orderBy: { price: "desc" },
        select: { id: true },
      }),
    ]);
    if (!tiers.length) return;

    await db.sessionSectionPricing.deleteMany({
      where: { eventId: sessionRow.eventId },
    });
    await db.sessionSectionPricing.createMany({
      data: sections.map((sec, i) => ({
        eventId: sessionRow.eventId,
        sectionId: sec.id,
        ticketTypeId: tiers[Math.min(i, tiers.length - 1)].id,
      })),
    });
  }

  /**
   * The arena goes on a *different* showing, so both sides of
   * `DIRECT_RENDER_THRESHOLD` are reachable without editing anything: the
   * theatre (468 seats) renders its seats immediately, the arena (9,080
   * capacity) exercises the progressive drill-in.
   */
  /**
   * …and one whose tiers can actually hold a stand.
   *
   * This asked only for "not the theatre, and more than one tier", so the arena
   * landed on whichever such event the sort happened to leave second — and
   * `attach` then priced each 1,496-seat stand against a tier by index,
   * cheapest for anything past the last one. A seminar with a 30-seat student
   * ticket satisfied every condition and produced a 9,080-capacity arena whose
   * stands sold out after thirty seats.
   *
   * That is incoherent as data, and `tests/api/hold-abuse.test.ts` is where it
   * surfaced: it looks for a section big enough that the per-address ceiling is
   * what stops a run, and got one that ran out of tickets first.
   *
   * The bar is a sanity check, not a real capacity: the seeded multi-tier
   * events run 200–1,200 a tier, and «کنسرت همایون شجریان» — the intended
   * arena event — has a 300-seat floor. 200 keeps a 30-seat student ticket out
   * without excluding the fixtures this is meant to choose between.
   */
  const ARENA_TIER_FLOOR = 200;
  const arenaSession = candidates.find(
    (c) =>
      c.id !== session?.id &&
      c.event.ticketTypes.length > 1 &&
      c.event.ticketTypes.every((t) => t.capacity >= ARENA_TIER_FLOOR),
  );
  if (arenaSession && arenaVersion) {
    await attach(arenaSession, arenaVersion);
  }

  // Same path as the arena — one implementation, so neither can drift into an
  // incoherent venue again.
  if (session && theatreVersion) {
    await attach(session, theatreVersion);
  }

  // The designer is staff-only, so the seeded owner needs the flag or a fresh
  // clone has no way in.
  const owner = await db.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (owner) {
    await db.user.update({
      where: { id: owner.id },
      data: { platformAdmin: true },
    });
  }
}
