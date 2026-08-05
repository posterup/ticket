/**
 * Seat holds — the concurrency core.
 *
 * A hold is the short-lived claim a customer takes while choosing seats and
 * filling in the checkout form. It exists because `TicketType.reserved` counts
 * *how many* seats are spoken for and cannot express *which*.
 *
 * Acquisition is a single conditional `INSERT` whose affected-row count is the
 * verdict — the same optimistic-concurrency shape `reserve()` uses in
 * `lib/server/orders.ts`, and for the same reason: two buyers racing for the
 * last seat must not be able to interleave a check and a write. No Redis, no
 * advisory locks, no transaction retry loop.
 */

import { randomUUID } from "node:crypto";

import { db } from "@/lib/server/db";
import { HttpError, notFound } from "@/lib/server/http";
import { formatNumber } from "@/lib/format";
import type { HoldResult } from "@/types";

/**
 * Seat holds outlive order holds on purpose.
 *
 * `HOLD_MINUTES` in `orders.ts` is 15. If a seat hold expired first, a buyer
 * sitting on the payment gateway would have their seats resold underneath a
 * live transaction. Holds are also transferred to the order rather than left to
 * lapse — see `attachHoldsToOrder`.
 */
export const SEAT_HOLD_MINUTES = 20;

/**
 * Anti-inventory-denial cap.
 *
 * Holding is free and anonymous, so without a ceiling one script can hold every
 * seat in the house and take the show off sale at no cost.
 */
export const MAX_SEATS_PER_HOLDER = 10;

/**
 * The same ceiling, per network address, across every holder key.
 *
 * `MAX_SEATS_PER_HOLDER` alone is not a cap on anything: a guest's holderKey is
 * a cookie *they* control, so a script that clears it gets another ten seats,
 * and another, until it is holding the house. `docs/venue-architecture.md`
 * §13.11 called this out — "without per-session caps and rate limits, a trivial
 * bot holds every seat" — and only the per-holder half was built.
 *
 * Three times the per-holder allowance, because a household, an office or a
 * phone network share an address and several of them may genuinely be buying
 * at once. It bounds one machine to thirty seats rather than to all of them; it
 * is a ceiling on damage, not a bot detector.
 */
export const MAX_SEATS_PER_IP = MAX_SEATS_PER_HOLDER * 3;

/**
 * Release lapsed holds for one showing.
 *
 * Called at the top of every acquisition, mirroring how `createOrder` sweeps
 * expired orders inline — serverless has no long-lived process to run a cron,
 * and the only moment anyone cares whether a hold has lapsed is when someone
 * else reaches for the same seat.
 */
export async function releaseExpiredHolds(sessionId: string): Promise<number> {
  const { count } = await db.seatHold.deleteMany({
    where: { sessionId, expiresAt: { lt: new Date() }, orderId: null },
  });
  return count;
}

interface SeatRef {
  id: string;
  index: number;
}

async function resolveSeats(
  sessionId: string,
  sectionKey: string,
  indices: number[],
): Promise<{ sectionId: string; seats: SeatRef[]; eventId: string }> {
  const session = await db.eventSession.findUnique({
    where: { id: sessionId },
    select: {
      layoutVersionId: true,
      cancelled: true,
      availability: true,
      eventId: true,
    },
  });
  if (!session?.layoutVersionId) throw notFound("این سانس نقشه صندلی ندارد.");
  if (session.cancelled) {
    throw new HttpError(409, "SALES_CLOSED", "این سانس لغو شده است.");
  }
  // Holds are the other way in. Letting someone take a seat in a closed showing
  // and only refusing them at checkout wastes twenty minutes of inventory and
  // tells them no at the worst possible moment.
  if (session.availability === "FULL") {
    throw new HttpError(409, "SOLD_OUT", "ظرفیت این سانس تکمیل شده است.");
  }
  if (session.availability === "SOON") {
    throw new HttpError(409, "SALES_CLOSED", "فروش این سانس هنوز آغاز نشده است.");
  }

  const section = await db.venueSection.findUnique({
    where: {
      versionId_key: { versionId: session.layoutVersionId, key: sectionKey },
    },
    select: { id: true, kind: true },
  });
  if (!section) throw notFound("بخش پیدا نشد.");
  if (section.kind === "STANDING") {
    throw new HttpError(
      400,
      "INVALID_BODY",
      "بخش ایستاده صندلی شماره‌دار ندارد.",
    );
  }

  const seats = await db.venueSeat.findMany({
    where: { sectionId: section.id, index: { in: indices } },
    select: { id: true, index: true, kind: true },
  });
  if (seats.length !== indices.length) {
    throw notFound("بعضی از صندلی‌های انتخابی وجود ندارند.");
  }

  // House seats are the venue's own allocation. Until now nothing stopped a
  // customer holding one — the exclusion existed only as a comment.
  if (seats.some((seat) => seat.kind === "HOUSE")) {
    throw new HttpError(
      409,
      "SEAT_TAKEN",
      "این صندلی برای سالن نگه داشته شده است.",
    );
  }

  return { sectionId: section.id, seats, eventId: session.eventId };
}


/**
 * How many more tickets the section's allocation will actually grant.
 *
 * A section's seats and its `TicketType` are two different ceilings, and
 * `createOrder` reserves against the second. Nothing checked it here, so a
 * buyer could take seats in a section whose allocation was exhausted, hold them
 * for twenty minutes, and be refused at submit — while those seats sat
 * unavailable to everyone else for a sale that could never complete.
 *
 * Live holds are subtracted as well as `reserved`. Holds do not touch the
 * counter (they are transient and swept), so without this ten shoppers could
 * each hold the last ten seats of a ten-ticket allocation and nine of them
 * would find out only at checkout.
 *
 * Returns `Infinity` for an unpriced section: `priceSeatSelection` refuses
 * those with a clearer error, and inventing a limit here would mask it.
 */
async function allocationRemaining(
  sessionId: string,
  eventId: string,
  sectionId: string,
  holderKey: string,
): Promise<number> {
  const pricing = await db.sessionSectionPricing.findFirst({
    where: { eventId, sectionId },
    select: {
      ticketTypeId: true,
      ticketType: {
        select: {
          capacity: true,
          sold: true,
          reserved: true,
          salesStartAt: true,
          salesEndAt: true,
          name: true,
        },
      },
    },
  });
  if (!pricing) return Number.POSITIVE_INFINITY;

  /**
   * Sales have to be open.
   *
   * `createOrder` refuses a ticket type outside its window with
   * `SALES_CLOSED`, and `findBestAvailable` skips those sections — but this
   * path did neither, so the manual picker would hand someone seats in a tier
   * that does not open until next week and refuse them at submit, twenty
   * minutes of held inventory later. The same hole, on the one entry point
   * that had not been given the check.
   */
  const now = new Date();
  if (pricing.ticketType.salesStartAt > now) {
    throw new HttpError(
      409,
      "SALES_CLOSED",
      `فروش «${pricing.ticketType.name}» هنوز آغاز نشده است.`,
    );
  }
  if (pricing.ticketType.salesEndAt < now) {
    throw new HttpError(
      409,
      "SALES_CLOSED",
      `فروش «${pricing.ticketType.name}» به پایان رسیده است.`,
    );
  }

  // Every section this ticket type prices — they draw on one allocation.
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

/**
 * Claim one seat.
 *
 * The statement refuses a sold seat, takes a free one, and steals one whose
 * hold has lapsed — atomically, in a single round trip:
 *
 *   INSERT … SELECT … WHERE NOT EXISTS (sold)
 *   ON CONFLICT (sessionId, seatId) DO UPDATE … WHERE existing.expiresAt < now()
 *
 * `NOT EXISTS` rejects sold seats. The conflict clause is what makes a live
 * hold win and a lapsed one lose. Returns true when this caller got the seat.
 */
export async function claimSeat(
  sessionId: string,
  seatId: string,
  holderKey: string,
  expiresAt: Date,
  ip?: string,
): Promise<boolean> {
  const affected = await db.$executeRaw`
    INSERT INTO "SeatHold" ("id", "sessionId", "seatId", "holderKey", "ip", "expiresAt", "createdAt")
    SELECT ${randomUUID()}, ${sessionId}, ${seatId}, ${holderKey}, ${ip ?? null}, ${expiresAt}, now()
     WHERE NOT EXISTS (
       SELECT 1 FROM "SeatStatus"
        WHERE "sessionId" = ${sessionId} AND "seatId" = ${seatId}
     )
    ON CONFLICT ("sessionId", "seatId") DO UPDATE
       SET "holderKey" = EXCLUDED."holderKey",
           "ip" = EXCLUDED."ip",
           "expiresAt" = EXCLUDED."expiresAt",
           "createdAt" = now()
     WHERE "SeatHold"."expiresAt" < now()
        OR "SeatHold"."holderKey" = ${holderKey}
  `;
  return affected === 1;
}

/**
 * Hold a set of seats in one section.
 *
 * Partial success is reported rather than rolled back: if a customer picks four
 * seats and loses one to a faster buyer, taking the other three and telling
 * them which one went is a better outcome than dropping all four and making
 * them start over.
 */
export async function holdSeats(input: {
  sessionId: string;
  section: string;
  seats: number[];
  holderKey: string;
  /** For the per-address ceiling. Absent in tests and server-side callers. */
  ip?: string;
}): Promise<HoldResult> {
  const { sessionId, section, seats: indices, holderKey, ip } = input;

  if (!indices.length) {
    throw new HttpError(400, "INVALID_BODY", "هیچ صندلی انتخاب نشده است.");
  }

  await releaseExpiredHolds(sessionId);

  const existing = await db.seatHold.count({
    where: { sessionId, holderKey, expiresAt: { gt: new Date() } },
  });
  if (existing + indices.length > MAX_SEATS_PER_HOLDER) {
    throw new HttpError(
      429,
      "HOLD_LIMIT",
      `حداکثر ${formatNumber(MAX_SEATS_PER_HOLDER)} صندلی هم‌زمان می‌توانید نگه دارید.`,
    );
  }

  // Across every holder key from this address — the half that a cleared cookie
  // cannot get around.
  if (ip) {
    const fromHere = await db.seatHold.count({
      where: { sessionId, ip, expiresAt: { gt: new Date() } },
    });
    if (fromHere + indices.length > MAX_SEATS_PER_IP) {
      throw new HttpError(
        429,
        "HOLD_LIMIT",
        `از این اتصال حداکثر ${formatNumber(MAX_SEATS_PER_IP)} صندلی هم‌زمان قابل نگه‌داری است.`,
      );
    }
  }

  const { seats, sectionId, eventId } = await resolveSeats(
    sessionId,
    section,
    indices,
  );

  // The seats may be free while the allocation behind them is not.
  const remaining = await allocationRemaining(
    sessionId,
    eventId,
    sectionId,
    holderKey,
  );
  const mineHere = await db.seatHold.count({
    where: {
      sessionId,
      holderKey,
      expiresAt: { gt: new Date() },
      seat: { sectionId },
    },
  });
  if (mineHere + indices.length > remaining) {
    throw new HttpError(
      409,
      "SOLD_OUT",
      remaining <= mineHere
        ? "ظرفیت بلیت این بخش تکمیل شده است."
        : `تنها ${formatNumber(remaining - mineHere)} بلیت از این بخش باقی مانده است.`,
    );
  }

  const expiresAt = new Date(Date.now() + SEAT_HOLD_MINUTES * 60_000);

  const acquired: number[] = [];
  const rejected: number[] = [];

  // Sorted by seat id so two concurrent multi-seat requests cannot deadlock on
  // opposite lock orders — the same discipline createOrder uses for its lines.
  for (const seat of [...seats].sort((a, b) => a.id.localeCompare(b.id))) {
    const won = await claimSeat(sessionId, seat.id, holderKey, expiresAt, ip);
    (won ? acquired : rejected).push(seat.index);
  }

  if (!acquired.length) {
    throw new HttpError(
      409,
      "SEAT_TAKEN",
      "این صندلی‌ها همین حالا رزرو شدند. لطفاً صندلی دیگری انتخاب کنید.",
    );
  }

  return {
    sessionId,
    section,
    acquired: acquired.sort((a, b) => a - b),
    rejected: rejected.sort((a, b) => a - b),
    expiresAt: expiresAt.toISOString(),
  };
}

/** Give seats back. Only the holder may, and never once an order owns them. */
export async function releaseSeats(input: {
  sessionId: string;
  holderKey: string;
  section?: string;
  seats?: number[];
}): Promise<{ released: number }> {
  const { sessionId, holderKey, section, seats } = input;

  if (section && seats?.length) {
    const { seats: refs } = await resolveSeats(sessionId, section, seats);
    const { count } = await db.seatHold.deleteMany({
      where: {
        sessionId,
        holderKey,
        orderId: null,
        seatId: { in: refs.map((r) => r.id) },
      },
    });
    return { released: count };
  }

  const { count } = await db.seatHold.deleteMany({
    where: { sessionId, holderKey, orderId: null },
  });
  return { released: count };
}

/** The caller's live holds for a showing, so a reload restores their picks. */
export async function listHolds(
  sessionId: string,
  holderKey: string,
): Promise<{ section: string; seats: number[]; expiresAt: string }[]> {
  const rows = await db.seatHold.findMany({
    where: { sessionId, holderKey, expiresAt: { gt: new Date() } },
    select: {
      expiresAt: true,
      seat: { select: { index: true, section: { select: { key: true } } } },
    },
  });

  const grouped = new Map<string, { seats: number[]; expiresAt: string }>();
  for (const row of rows) {
    const key = row.seat.section.key;
    const entry = grouped.get(key) ?? {
      seats: [],
      expiresAt: row.expiresAt.toISOString(),
    };
    entry.seats.push(row.seat.index);
    grouped.set(key, entry);
  }

  return [...grouped.entries()].map(([section, v]) => ({
    section,
    seats: v.seats.sort((a, b) => a - b),
    expiresAt: v.expiresAt,
  }));
}

/**
 * Bind live holds to an order at checkout.
 *
 * Transfer, not re-check: the customer already won the race when they picked
 * the seats, and making them race again at submit is how you sell someone a
 * ticket and then take the seat away. Once `orderId` is set the sweeper leaves
 * the hold alone, and settlement converts it to a `SeatStatus` row.
 */
export async function attachHoldsToOrder(input: {
  sessionId: string;
  holderKey: string;
  orderId: string;
  seatIds: string[];
}): Promise<number> {
  const { count } = await db.seatHold.updateMany({
    where: {
      sessionId: input.sessionId,
      holderKey: input.holderKey,
      seatId: { in: input.seatIds },
      expiresAt: { gt: new Date() },
    },
    data: { orderId: input.orderId },
  });

  if (count !== input.seatIds.length) {
    throw new HttpError(
      409,
      "HOLD_EXPIRED",
      "زمان نگه‌داری صندلی‌ها تمام شد. لطفاً دوباره انتخاب کنید.",
    );
  }
  return count;
}

// ───────────────────── checkout: holds → order ─────────────────────

export interface PricedSeatLine {
  ticketTypeId: string;
  sectionKey: string;
  sectionName: string;
  quantity: number;
  seatIds: string[];
  /** Section-local indices, for the error messages. */
  indices: number[];
}

/**
 * Turn a seat selection into order lines.
 *
 * The client sends *which seats*, never which ticket type or what they cost —
 * the section→`TicketType` mapping and the price both come from the database.
 * A request that names its own totals is describing what it would like to pay.
 *
 * Every seat must already be held by this caller. Re-racing at submit is how you
 * take a seat back off someone who is halfway through paying for it.
 */
export async function priceSeatSelection(input: {
  eventId: string;
  sessionId: string;
  selections: { section: string; seats: number[] }[];
  holderKey: string;
}): Promise<PricedSeatLine[]> {
  const { eventId, sessionId, selections, holderKey } = input;

  const session = await db.eventSession.findUnique({
    where: { id: sessionId },
    select: { layoutVersionId: true, eventId: true },
  });
  if (!session?.layoutVersionId) throw notFound("این سانس نقشه صندلی ندارد.");
  if (session.eventId !== eventId) {
    throw new HttpError(400, "INVALID_BODY", "سانس با رویداد هم‌خوان نیست.");
  }

  const keys = selections.map((s) => s.section);
  const sections = await db.venueSection.findMany({
    where: { versionId: session.layoutVersionId, key: { in: keys } },
    select: { id: true, key: true, name: true, kind: true },
  });
  if (sections.length !== new Set(keys).size) {
    throw notFound("بخش انتخابی پیدا نشد.");
  }

  const pricing = await db.sessionSectionPricing.findMany({
    where: { eventId, sectionId: { in: sections.map((s) => s.id) } },
    select: { sectionId: true, ticketTypeId: true },
  });
  const ticketTypeBySection = new Map(
    pricing.map((p) => [p.sectionId, p.ticketTypeId]),
  );

  const lines: PricedSeatLine[] = [];

  for (const selection of selections) {
    const section = sections.find((s) => s.key === selection.section)!;
    if (section.kind === "STANDING") {
      throw new HttpError(
        400,
        "INVALID_BODY",
        `بخش «${section.name}» ایستاده است و صندلی شماره‌دار ندارد.`,
      );
    }

    const ticketTypeId = ticketTypeBySection.get(section.id);
    if (!ticketTypeId) {
      // A layout can outlive the pricing an organiser set up for it.
      throw new HttpError(
        409,
        "CONFLICT",
        `برای بخش «${section.name}» بلیتی تعیین نشده است.`,
      );
    }

    const seats = await db.venueSeat.findMany({
      where: { sectionId: section.id, index: { in: selection.seats } },
      select: { id: true, index: true },
    });
    if (seats.length !== new Set(selection.seats).size) {
      throw notFound("بعضی از صندلی‌های انتخابی وجود ندارند.");
    }

    // Held by *this* caller, and not already lapsed.
    const mine = await db.seatHold.findMany({
      where: {
        sessionId,
        holderKey,
        orderId: null,
        expiresAt: { gt: new Date() },
        seatId: { in: seats.map((s) => s.id) },
      },
      select: { seatId: true },
    });
    if (mine.length !== seats.length) {
      throw new HttpError(
        409,
        "HOLD_EXPIRED",
        "زمان نگه‌داری صندلی‌ها تمام شد. لطفاً دوباره انتخاب کنید.",
      );
    }

    lines.push({
      ticketTypeId,
      sectionKey: section.key,
      sectionName: section.name,
      quantity: seats.length,
      seatIds: seats.map((s) => s.id),
      indices: seats.map((s) => s.index),
    });
  }

  return lines;
}

/**
 * Give an order's seats back.
 *
 * Called when an order expires, fails or is cancelled. The holds are deleted
 * outright rather than unbound and left to lapse — the buyer has gone, and
 * making the next customer wait out a 20-minute TTL for a seat nobody wants is
 * lost revenue.
 */
export async function releaseOrderHolds(orderIds: string[]): Promise<number> {
  if (!orderIds.length) return 0;
  const { count } = await db.seatHold.deleteMany({
    where: { orderId: { in: orderIds } },
  });
  return count;
}
