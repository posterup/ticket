/**
 * Telling ticket holders a show is off.
 *
 * This is the highest-stakes message a ticketing platform ever sends, and until
 * now it was not sent at all. An organiser could cancel a سانس — or a whole
 * event — and nobody was told. People found out by arriving.
 *
 * Everything else on the platform can be discovered by opening the app. This
 * cannot: the entire point is to reach someone who has no reason to look.
 *
 * **Never throws**, on the same reasoning as `order-paid`: the cancellation is
 * a deliberate act by an organiser and must not fail because an SMS operator is
 * having a bad afternoon. Failures are logged; the event page tells the truth
 * either way.
 *
 * **Only on the transition into cancelled.** Saving an already-cancelled سانس,
 * which a form does every time it is submitted, must not message a thousand
 * people twice.
 */

import { db } from "@/lib/server/db";
import { smsGateway } from "@/lib/server/sms";
import { eventCancelledText, sessionCancelledText } from "./messages";
import { formatNumber } from "@/lib/format";

export interface CancelNotice {
  attempted: boolean;
  ok: boolean;
  /** Distinct people messaged, not tickets. */
  recipients: number;
  error?: string;
}

const QUIET: CancelNotice = { attempted: false, ok: false, recipients: 0 };

/**
 * Which paid orders a cancellation covers.
 *
 * Half the paid orders in this database carry no `sessionId` — for a
 * single-session event checkout has no session to record. A plain
 * `where: { sessionId }` therefore silently skips those buyers, which on a
 * one-off event means *nobody* is told the show is off. That is the failure
 * this whole module exists to prevent, so it is handled rather than assumed
 * away.
 *
 * When the event has exactly one سانس, an order with no session can only be
 * for that one, and is included. When there are several it is genuinely
 * ambiguous, and texting five showings' worth of buyers that their show is
 * cancelled would be worse than the gap — so those are left out and logged as
 * the checkout bug they are.
 */
async function scope(
  eventId: string,
  sessionId?: string,
): Promise<{ eventId: string; status: "PAID"; OR?: object[]; sessionId?: string }> {
  if (!sessionId) return { eventId, status: "PAID" };

  const sessions = await db.eventSession.count({ where: { eventId } });
  if (sessions <= 1) {
    return {
      eventId,
      status: "PAID",
      OR: [{ sessionId }, { sessionId: null }],
    };
  }

  const orphans = await db.order.count({
    where: { eventId, status: "PAID", sessionId: null },
  });
  if (orphans > 0) {
    console.warn(
      `[notify] ${orphans} paid order(s) on event ${eventId} name no سانس; ` +
        `they cannot be attributed to a cancelled showing and were not messaged.`,
    );
  }
  return { eventId, status: "PAID", sessionId };
}

/**
 * Everyone holding a live ticket, one entry per person.
 *
 * Deduplicated by phone: someone who bought four seats gets one message, not
 * four. Scoped to `PAID` because an abandoned or expired order is not a person
 * who is planning to turn up.
 */
async function holders(
  eventId: string,
  sessionId?: string,
): Promise<string[]> {
  const orders = await db.order.findMany({
    where: await scope(eventId, sessionId),
    select: { buyerPhone: true },
  });
  return [...new Set(orders.map((o) => o.buyerPhone).filter(Boolean))];
}

async function send(text: string, phones: string[]): Promise<CancelNotice> {
  if (!phones.length) return { attempted: false, ok: true, recipients: 0 };
  const result = await smsGateway().sendBulk(phones, text);
  return {
    attempted: true,
    ok: result.ok,
    recipients: result.ok ? phones.length : 0,
    error: result.error,
  };
}

/** One سانس of an event is off; the rest of the event stands. */
export async function notifySessionCancelled(
  eventId: string,
  sessionId: string,
): Promise<CancelNotice> {
  try {
    if (!smsGateway().configured) return QUIET;

    const session = await db.eventSession.findUnique({
      where: { id: sessionId },
      select: { startAt: true, event: { select: { title: true } } },
    });
    if (!session) return QUIET;

    const text = sessionCancelledText({
      eventTitle: session.event.title,
      startAt: session.startAt.toISOString(),
    });

    return await send(text, await holders(eventId, sessionId));
  } catch (error) {
    // Deliberately swallowed — see the file header.
    console.error("[notify] session-cancelled failed", sessionId, error);
    return QUIET;
  }
}

/** The whole event is off. */
export async function notifyEventCancelled(
  eventId: string,
): Promise<CancelNotice> {
  try {
    if (!smsGateway().configured) return QUIET;

    const event = await db.event.findUnique({
      where: { id: eventId },
      select: { title: true },
    });
    if (!event) return QUIET;

    const text = eventCancelledText({ eventTitle: event.title });

    return await send(text, await holders(eventId));
  } catch (error) {
    console.error("[notify] event-cancelled failed", eventId, error);
    return QUIET;
  }
}

/**
 * How many people a cancellation would reach.
 *
 * The dashboard asks before it acts: cancelling a sold-out show is
 * irreversible in the only way that matters — you cannot un-send a thousand
 * text messages — so the organiser is told the size of what they are about to
 * do first.
 */
export async function cancellationReach(
  eventId: string,
  sessionId?: string,
): Promise<{ people: number; tickets: number; smsConfigured: boolean }> {
  const orders = await db.order.findMany({
    where: await scope(eventId, sessionId),
    select: { buyerPhone: true, items: { select: { quantity: true } } },
  });
  return {
    /**
     * Whether that reach is real.
     *
     * This counted orders and nothing else, and the dialog turned the number
     * into «به ۱٬۲۰۰ خریدار پیامک لغو می‌رود» — a thousand people *will be*
     * told. But `notifySessionCancelled` opens with `if (!smsGateway()
     * .configured) return QUIET`, so with no operator credentials the count is
     * a description of an audience nobody is going to reach.
     *
     * An organiser cancels believing their buyers have been informed. The
     * buyers turn up. Of the eight places that fall silent this way, this is
     * the one where the silence is the whole point of the action.
     */
    smsConfigured: smsGateway().configured,
    people: new Set(orders.map((o) => o.buyerPhone).filter(Boolean)).size,
    tickets: orders.reduce(
      (sum, o) => sum + o.items.reduce((n, i) => n + i.quantity, 0),
      0,
    ),
  };
}

/** Persian digits for anywhere this count is rendered. */
export const fa = (n: number) => formatNumber(n);
