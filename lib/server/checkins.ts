/**
 * Door check-in, against issued tickets.
 *
 * Previously an in-memory `Set` of synthetic holder ids invented by
 * `lib/checkin/data.ts` — there were no real tickets to admit. Now a scan
 * resolves a `qrToken` to its ticket and records a `CheckIn` row, whose unique
 * constraint on `ticketId` is what makes a second scan a duplicate rather than
 * a second admission.
 */

import { db } from "./db";

/** A سانس, as the door's selector shows it. */
export interface SessionRef {
  id: string;
  label: string;
}

/** A ticket as the door sees it. */
export interface Holder {
  id: string;
  /** Human-readable, printed on the ticket: order code plus a sequence. */
  code: string;
  /** What the scanner reads. */
  qrToken: string;
  name: string;
  ticketType: string;
  sessionId: string;
  sessionLabel: string;
}

export type CheckinOutcome =
  | { ok: true; ticketId: string; holderName: string; checked: boolean }
  | {
      ok: false;
      reason: "not-found" | "wrong-event" | "already" | "not-valid";
      message: string;
      /** Present for `already`, so the door can say who and when. */
      holderName?: string;
      checkedInAt?: string;
    };

/** Ticket ids already admitted for an event. */
export async function listCheckedTicketIds(eventId: string): Promise<string[]> {
  const rows = await db.checkIn.findMany({
    where: { ticket: { ticketType: { eventId } } },
    select: { ticketId: true },
  });
  return rows.map((r) => r.ticketId);
}

/**
 * Admit or un-admit a ticket by its scanned token.
 *
 * `eventId` is required: a token from another event is a scan at the wrong
 * door, and must be refused rather than silently admitted.
 */
export async function setCheckinByToken(
  eventId: string,
  qrToken: string,
  checked: boolean,
  byUserId?: string,
): Promise<CheckinOutcome> {
  const ticket = await db.ticket.findUnique({
    where: { qrToken },
    include: {
      checkIn: true,
      ticketType: { select: { eventId: true } },
    },
  });

  if (!ticket) {
    return { ok: false, reason: "not-found", message: "بلیت یافت نشد." };
  }
  if (ticket.ticketType.eventId !== eventId) {
    return {
      ok: false,
      reason: "wrong-event",
      message: "این بلیت برای رویداد دیگری است.",
    };
  }
  if (ticket.status === "CANCELLED" || ticket.status === "REFUNDED") {
    return {
      ok: false,
      reason: "not-valid",
      message: "این بلیت باطل شده است.",
    };
  }

  if (!checked) {
    await db.$transaction([
      db.checkIn.deleteMany({ where: { ticketId: ticket.id } }),
      db.ticket.update({ where: { id: ticket.id }, data: { status: "ISSUED" } }),
    ]);
    return {
      ok: true,
      ticketId: ticket.id,
      holderName: ticket.holderName,
      checked: false,
    };
  }

  // The unique constraint on ticketId is the real guard; this reports who
  // already came through rather than just refusing.
  if (ticket.checkIn) {
    return {
      ok: false,
      reason: "already",
      message: "این بلیت قبلاً ثبت ورود شده است.",
      holderName: ticket.holderName,
      checkedInAt: ticket.checkIn.checkedInAt.toISOString(),
    };
  }

  await db.$transaction([
    db.checkIn.create({
      data: { ticketId: ticket.id, checkedById: byUserId },
    }),
    db.ticket.update({
      where: { id: ticket.id },
      data: { status: "CHECKED_IN" },
    }),
  ]);

  return {
    ok: true,
    ticketId: ticket.id,
    holderName: ticket.holderName,
    checked: true,
  };
}

/**
 * Every issued ticket for an event, as the door list.
 *
 * Only from paid orders — an abandoned checkout must not appear on a guest
 * list.
 */
export async function listHolders(
  eventId: string,
  sessionLabels: Map<string, string>,
): Promise<Holder[]> {
  const tickets = await db.ticket.findMany({
    where: {
      ticketType: { eventId },
      order: { status: "PAID" },
      status: { in: ["ISSUED", "CHECKED_IN"] },
    },
    include: {
      order: { select: { code: true } },
      ticketType: { select: { name: true } },
    },
    orderBy: { issuedAt: "asc" },
  });

  const seqByOrder = new Map<string, number>();
  return tickets.map((t) => {
    const seq = (seqByOrder.get(t.orderId) ?? 0) + 1;
    seqByOrder.set(t.orderId, seq);
    return {
      id: t.id,
      code: `${t.order.code}-${seq}`,
      qrToken: t.qrToken,
      name: t.holderName,
      ticketType: t.ticketType.name,
      sessionId: t.sessionId ?? "",
      sessionLabel: t.sessionId ? (sessionLabels.get(t.sessionId) ?? "") : "",
    };
  });
}
