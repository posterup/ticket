/**
 * "Pick good seats for me."
 *
 * Most buyers do not want to study a seat map. They want N seats together, at a
 * price, without thinking about it. Every serious ticketing platform leads with
 * that and treats the map as *refinement* — see `docs/venue-architecture.md`
 * §13.3, where the absence of this was the strongest disagreement with the
 * original brief.
 *
 * Until now the only path to a seat was: open the overview, choose a section,
 * wait for its geometry, read a canvas, and click. That is the right flow for
 * the minority who care where they sit, and a tax on everyone else.
 *
 * The result of this is a *hold*, not a suggestion. Returning coordinates for
 * the client to then go and claim would reintroduce the race the hold exists to
 * settle — by the time the buyer saw the recommendation it could already be
 * gone. This picks and takes in one call, and falls through to the next-best
 * candidate when it loses.
 */

import { db } from "@/lib/server/db";
import { HttpError, notFound } from "@/lib/server/http";
import { formatNumber } from "@/lib/format";

import {
  MAX_SEATS_PER_HOLDER,
  MAX_SEATS_PER_IP,
  SEAT_HOLD_MINUTES,
  claimSeat,
  releaseExpiredHolds,
} from "./holds";

/** How many candidate runs to try before giving up. */
const MAX_ATTEMPTS = 4;

/**
 * Weight of centrality against row depth when ranking runs inside a section.
 *
 * Both matter and neither dominates. Being off to the side of a hall is felt
 * more sharply than being a few rows back — a seat at the end of row 3 looks at
 * the stage sideways, while the centre of row 8 does not — so centrality leads,
 * but not so far that the back wall outranks the front.
 *
 * Across sections this does not apply at all: the ops team's authored `tier`
 * decides, because no formula knows that a centre balcony beats a front-side
 * stall.
 */
const CENTRALITY_WEIGHT = 0.6;
const DEPTH_WEIGHT = 1 - CENTRALITY_WEIGHT;

export interface BestAvailableRequest {
  sessionId: string;
  quantity: number;
  holderKey: string;
  /** Restrict to one section — "best available *in the balcony*". */
  sectionKey?: string;
  /** Toman ceiling per seat. */
  maxPrice?: number;
  /** Look for wheelchair spaces rather than avoiding them. */
  accessible?: boolean;
  /** For the per-address ceiling; see `MAX_SEATS_PER_IP`. */
  ip?: string;
}

export interface BestAvailableResult {
  sessionId: string;
  section: string;
  sectionName: string;
  /** Section-local indices, in seat order. */
  seats: number[];
  /** Human labels — «ردیف C، صندلی‌های ۱۲ تا ۱۵». */
  rowLabel: string;
  seatLabels: string[];
  unitPrice?: number;
  expiresAt: string;
}

interface SeatRow {
  id: string;
  index: number;
  label: string;
  x: number;
  kind: string;
  rowId: string;
}

interface Candidate {
  seats: SeatRow[];
  score: number;
}

/**
 * Contiguous runs of `quantity` free seats in one row.
 *
 * Adjacency is consecutive `index` within the same row, which is what the
 * generator produces along a row's line. It is deliberately *not* proximity in
 * `x`: two seats either side of an aisle are close together and are not
 * "together", and until aisles are authored (a documented gap) index adjacency
 * is the only honest signal we have.
 */
function runsInRow(
  seats: SeatRow[],
  quantity: number,
  taken: ReadonlySet<number>,
): SeatRow[][] {
  const ordered = [...seats].sort((a, b) => a.index - b.index);
  const runs: SeatRow[][] = [];

  // Every window of the requested length from each maximal free stretch, so a
  // gap of 6 with quantity 2 offers all five positions and the scorer gets to
  // pick the most central rather than always the leftmost.
  let stretch: SeatRow[] = [];
  const flush = () => {
    for (let i = 0; i + quantity <= stretch.length; i++) {
      runs.push(stretch.slice(i, i + quantity));
    }
    stretch = [];
  };
  for (const seat of ordered) {
    if (
      taken.has(seat.index) ||
      (stretch.length > 0 &&
        seat.index !== stretch[stretch.length - 1].index + 1)
    ) {
      flush();
      if (taken.has(seat.index)) continue;
    }
    stretch.push(seat);
  }
  flush();

  return runs;
}

/**
 * Would taking this run strand a lone seat?
 *
 * A single orphaned seat between a sold block and a fresh booking is close to
 * unsellable — nobody comes to a show alone by choice, and it is the seat that
 * is still there at the end of the night. Ticketing systems call these "seat
 * gap rules"; the cheap version is to penalise a run that creates one rather
 * than forbid it, so a nearly-full house can still sell its last singles.
 *
 * `inRow` is scoped to the run's own row on purpose: seat indices are
 * section-local and run straight on from one row into the next, so a
 * section-wide map would call the last seat of row A a neighbour of the first
 * seat of row B and invent gaps across the aisle.
 */
function strandsSingle(
  run: SeatRow[],
  inRow: ReadonlyMap<number, SeatRow>,
  taken: ReadonlySet<number>,
): boolean {
  const free = (i: number) => inRow.has(i) && !taken.has(i);
  const before = run[0].index - 1;
  const after = run[run.length - 1].index + 1;
  return (
    (free(before) && !free(before - 1)) || (free(after) && !free(after + 1))
  );
}

export async function findBestAvailable(
  input: BestAvailableRequest,
): Promise<BestAvailableResult> {
  const { sessionId, quantity, holderKey, sectionKey, maxPrice } = input;

  if (quantity < 1 || quantity > MAX_SEATS_PER_HOLDER) {
    throw new HttpError(
      400,
      "INVALID_BODY",
      `بین ۱ تا ${formatNumber(MAX_SEATS_PER_HOLDER)} صندلی می‌توانید انتخاب کنید.`,
    );
  }

  const session = await db.eventSession.findUnique({
    where: { id: sessionId },
    select: {
      layoutVersionId: true,
      cancelled: true,
      eventId: true,
      availability: true,
    },
  });
  if (!session?.layoutVersionId) throw notFound("این سانس نقشه صندلی ندارد.");
  if (session.cancelled) {
    throw new HttpError(409, "SALES_CLOSED", "این سانس لغو شده است.");
  }
  if (session.availability === "FULL") {
    throw new HttpError(409, "SOLD_OUT", "ظرفیت این سانس تکمیل شده است.");
  }
  if (session.availability === "SOON") {
    throw new HttpError(409, "SALES_CLOSED", "فروش این سانس هنوز آغاز نشده است.");
  }

  await releaseExpiredHolds(sessionId);

  const alreadyHeld = await db.seatHold.count({
    where: { sessionId, holderKey, expiresAt: { gt: new Date() } },
  });
  if (alreadyHeld + quantity > MAX_SEATS_PER_HOLDER) {
    throw new HttpError(
      429,
      "HOLD_LIMIT",
      `حداکثر ${formatNumber(MAX_SEATS_PER_HOLDER)} صندلی هم‌زمان می‌توانید نگه دارید.`,
    );
  }

  // This claims seats directly rather than through `holdSeats`, so the
  // per-address ceiling has to be applied here too or it is simply a way round
  // it.
  if (input.ip) {
    const fromHere = await db.seatHold.count({
      where: { sessionId, ip: input.ip, expiresAt: { gt: new Date() } },
    });
    if (fromHere + quantity > MAX_SEATS_PER_IP) {
      throw new HttpError(
        429,
        "HOLD_LIMIT",
        `از این اتصال حداکثر ${formatNumber(MAX_SEATS_PER_IP)} صندلی هم‌زمان قابل نگه‌داری است.`,
      );
    }
  }

  const sections = await db.venueSection.findMany({
    where: {
      versionId: session.layoutVersionId,
      kind: "SEATED",
      ...(sectionKey ? { key: sectionKey } : {}),
    },
    select: { id: true, key: true, name: true, tier: true },
  });
  if (!sections.length) {
    throw notFound(
      sectionKey ? "بخش پیدا نشد." : "این سانس بخش صندلی‌دار ندارد.",
    );
  }

  /**
   * Only sections whose ticket type is on sale *right now*.
   *
   * `createOrder` rejects an out-of-window type with `SALES_CLOSED`, so without
   * this the picker would happily hand someone the best seats in a tier that
   * does not open until next week — a hold they hold for twenty minutes and can
   * never convert. When the buyer chooses a section themselves they at least
   * chose it; when the server chooses, it has to choose something buyable.
   */
  const now = new Date();
  const pricing = await db.sessionSectionPricing.findMany({
    where: {
      eventId: session.eventId,
      sectionId: { in: sections.map((s) => s.id) },
      ticketType: { salesStartAt: { lte: now }, salesEndAt: { gte: now } },
    },
    select: { sectionId: true, ticketType: { select: { price: true } } },
  });
  const priceBySection = new Map(
    pricing.map((p) => [p.sectionId, p.ticketType.price]),
  );

  /**
   * Sections the buyer could actually complete a purchase in, best first.
   *
   * An unpriced section is skipped rather than offered: `priceSeatSelection`
   * refuses it at checkout, so recommending seats there would hand someone a
   * hold they cannot convert.
   */
  const ordered = sections
    .filter((s) => {
      const price = priceBySection.get(s.id);
      if (price === undefined) return false;
      return maxPrice === undefined || price <= maxPrice;
    })
    .sort((a, b) => a.tier - b.tier || a.key.localeCompare(b.key));

  if (!ordered.length) {
    throw new HttpError(
      409,
      "CONFLICT",
      maxPrice !== undefined
        ? "در این محدوده قیمت صندلی‌ای پیدا نشد."
        : "فروش صندلی‌های این سانس فعال نیست.",
    );
  }

  const expiresAt = new Date(Date.now() + SEAT_HOLD_MINUTES * 60_000);

  // One section at a time, stopping at the first that yields seats. A 12,000-
  // seat arena never loads more than the tier the buyer is actually getting.
  for (const section of ordered) {
    /**
     * Skip a tier whose allocation cannot cover the request.
     *
     * This claims seats directly rather than going through `holdSeats`, so it
     * needs the same check: free seats in a section whose `TicketType` is spent
     * are seats the buyer will be refused at checkout, after holding them for
     * twenty minutes. Falling through to the next tier gives them something
     * they can actually buy.
     */
    if ((await remainingFor(session.eventId, section.id, holderKey, sessionId)) < quantity) {
      continue;
    }

    const candidates = await rankCandidates(
      sessionId,
      section.id,
      quantity,
      input.accessible ?? false,
    );

    for (const candidate of candidates.slice(0, MAX_ATTEMPTS)) {
      const won: SeatRow[] = [];
      for (const seat of [...candidate.seats].sort((a, b) =>
        a.id.localeCompare(b.id),
      )) {
        if (await claimSeat(sessionId, seat.id, holderKey, expiresAt, input.ip)) {
          won.push(seat);
        }
      }

      if (won.length === candidate.seats.length) {
        const seats = [...candidate.seats].sort((a, b) => a.index - b.index);
        const row = await db.venueRow.findUnique({
          where: { id: seats[0].rowId },
          select: { label: true },
        });
        return {
          sessionId,
          section: section.key,
          sectionName: section.name,
          seats: seats.map((s) => s.index),
          rowLabel: row?.label ?? "",
          seatLabels: seats.map((s) => s.label),
          unitPrice: priceBySection.get(section.id),
          expiresAt: expiresAt.toISOString(),
        };
      }

      // Lost the race part-way. Give back the partial run before trying the
      // next candidate — holding two seats of a four-seat request helps nobody
      // and counts against this holder's cap.
      if (won.length) {
        await db.seatHold.deleteMany({
          where: {
            sessionId,
            holderKey,
            orderId: null,
            seatId: { in: won.map((s) => s.id) },
          },
        });
      }
    }
  }

  throw new HttpError(
    409,
    "SEAT_TAKEN",
    quantity > 1
      ? `${formatNumber(quantity)} صندلی کنار هم پیدا نشد. صندلی‌ها را از روی نقشه جدا انتخاب کنید.`
      : "صندلی آزادی پیدا نشد.",
  );
}

/** Free runs in one section, best first. */
async function rankCandidates(
  sessionId: string,
  sectionId: string,
  quantity: number,
  accessible: boolean,
): Promise<Candidate[]> {
  const [seats, sold, held, rows] = await Promise.all([
    db.venueSeat.findMany({
      where: { sectionId },
      select: {
        id: true,
        index: true,
        label: true,
        x: true,
        kind: true,
        rowId: true,
      },
    }),
    db.seatStatus.findMany({
      where: { sessionId, seat: { sectionId } },
      select: { seat: { select: { index: true } } },
    }),
    db.seatHold.findMany({
      where: { sessionId, expiresAt: { gt: new Date() }, seat: { sectionId } },
      select: { seat: { select: { index: true } } },
    }),
    db.venueRow.findMany({
      where: { sectionId },
      select: { id: true, index: true },
    }),
  ]);

  const taken = new Set<number>([
    ...sold.map((r) => r.seat.index),
    ...held.map((r) => r.seat.index),
  ]);

  /**
   * Accessible seats are inventory, not a fallback.
   *
   * Auto-assigning a wheelchair space to someone who did not ask for one spends
   * the few seats a disabled buyer can actually use — the one kind of seat that
   * cannot be substituted. So they are excluded by default and *required* when
   * asked for. House seats are never sellable at all.
   */
  for (const seat of seats) {
    if (seat.kind === "HOUSE") taken.add(seat.index);
    if (accessible) {
      if (seat.kind !== "WHEELCHAIR" && seat.kind !== "COMPANION") {
        taken.add(seat.index);
      }
    } else if (seat.kind === "WHEELCHAIR" || seat.kind === "COMPANION") {
      taken.add(seat.index);
    }
  }

  const rowDepth = new Map(rows.map((r) => [r.id, r.index]));
  const maxDepth = Math.max(1, ...rows.map((r) => r.index));

  const byRow = new Map<string, SeatRow[]>();
  for (const seat of seats) {
    const list = byRow.get(seat.rowId);
    if (list) list.push(seat);
    else byRow.set(seat.rowId, [seat]);
  }

  const candidates: Candidate[] = [];

  for (const [rowId, rowSeats] of byRow) {
    const xs = rowSeats.map((s) => s.x);
    const centre = (Math.min(...xs) + Math.max(...xs)) / 2;
    const halfWidth = Math.max(1, (Math.max(...xs) - Math.min(...xs)) / 2);
    const depth = (rowDepth.get(rowId) ?? 0) / maxDepth;
    const inRow = new Map(rowSeats.map((s) => [s.index, s]));

    for (const run of runsInRow(rowSeats, quantity, taken)) {
      const runCentre =
        run.reduce((sum, s) => sum + s.x, 0) / Math.max(1, run.length);
      const offCentre = Math.min(1, Math.abs(runCentre - centre) / halfWidth);

      let score =
        CENTRALITY_WEIGHT * offCentre +
        DEPTH_WEIGHT * depth +
        // A restricted view is still worth selling — just last.
        (run.some((s) => s.kind === "OBSTRUCTED") ? 1 : 0);

      if (strandsSingle(run, inRow, taken)) score += 0.15;

      candidates.push({ seats: run, score });
    }
  }

  return candidates.sort((a, b) => a.score - b.score);
}

/**
 * Tickets the section's allocation will still grant, minus what other shoppers
 * are holding against it. Mirrors `allocationRemaining` in `./holds`, kept
 * separate only because that one is private to the hold path.
 */
async function remainingFor(
  eventId: string,
  sectionId: string,
  holderKey: string,
  sessionId: string,
): Promise<number> {
  const pricing = await db.sessionSectionPricing.findFirst({
    where: { eventId, sectionId },
    select: {
      ticketTypeId: true,
      ticketType: { select: { capacity: true, sold: true, reserved: true } },
    },
  });
  if (!pricing) return 0;

  const siblings = await db.sessionSectionPricing.findMany({
    where: { eventId, ticketTypeId: pricing.ticketTypeId },
    select: { sectionId: true },
  });
  const heldByOthers = await db.seatHold.count({
    where: {
      sessionId,
      expiresAt: { gt: new Date() },
      holderKey: { not: holderKey },
      seat: { sectionId: { in: siblings.map((s) => s.sectionId) } },
    },
  });

  return Math.max(
    0,
    pricing.ticketType.capacity -
      pricing.ticketType.sold -
      pricing.ticketType.reserved -
      heldByOthers,
  );
}
