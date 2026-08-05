/**
 * The waitlist.
 *
 * A queue for a sold-out event, ordered by arrival. This is not «خبرم کن» —
 * that is interest in an event that has not opened yet. A waitlist is a claim
 * on inventory that has run out, and the difference shows when stock reappears:
 * a notify subscriber is told the event exists; a waitlist entry is told that
 * *their* turn has come, in order.
 *
 * Position is derived from `createdAt` rather than stored. A stored position
 * has to be renumbered every time someone leaves, and renumbering under
 * concurrency is how two people end up sharing place four.
 */

import { db } from "@/lib/server/db";
import { HttpError, notFound } from "@/lib/server/http";
import { inBatches, normalizeMobile, smsGateway } from "@/lib/server/sms";
import { waitlistOpeningText } from "./notifications/messages";

export interface WaitlistPlace {
  id: string;
  /** 1-based, derived from arrival order. */
  position: number;
  quantity: number;
  createdAt: string;
  /** Total people ahead of and including this one. */
  total: number;
}

/**
 * Join, or return the place already held.
 *
 * Idempotent by phone: tapping "join" twice must not create a second entry, and
 * must not move anyone up or down the queue.
 */
export async function joinWaitlist(input: {
  eventId: string;
  name: string;
  phone: string;
  quantity: number;
}): Promise<WaitlistPlace> {
  const event = await db.event.findUnique({
    where: { id: input.eventId },
    select: { id: true, status: true, waitlist: true },
  });
  if (!event) throw notFound("رویداد یافت نشد.");
  if (event.status !== "PUBLISHED") {
    throw new HttpError(409, "SALES_CLOSED", "این رویداد فعال نیست.");
  }
  if (!event.waitlist) {
    throw new HttpError(
      409,
      "CONFLICT",
      "برای این رویداد لیست انتظار فعال نیست.",
    );
  }

  const phone = normalizeMobile(input.phone);

  const entry = await db.waitlistEntry.upsert({
    where: { eventId_phone: { eventId: event.id, phone } },
    // Re-joining may legitimately change how many they want; it must not reset
    // their place, so `createdAt` is left alone.
    update: { name: input.name, quantity: input.quantity },
    create: {
      eventId: event.id,
      name: input.name,
      phone,
      quantity: input.quantity,
    },
    select: { id: true, quantity: true, createdAt: true },
  });

  return placeOf(event.id, entry.id, entry.createdAt, entry.quantity);
}

async function placeOf(
  eventId: string,
  id: string,
  createdAt: Date,
  quantity: number,
): Promise<WaitlistPlace> {
  const [ahead, total] = await Promise.all([
    db.waitlistEntry.count({ where: { eventId, createdAt: { lt: createdAt } } }),
    db.waitlistEntry.count({ where: { eventId } }),
  ]);
  return {
    id,
    position: ahead + 1,
    quantity,
    createdAt: createdAt.toISOString(),
    total,
  };
}

/** Where this phone stands, or undefined if they never joined. */
export async function waitlistPlace(
  eventId: string,
  rawPhone: string,
): Promise<WaitlistPlace | undefined> {
  const phone = normalizeMobile(rawPhone);
  const entry = await db.waitlistEntry.findUnique({
    where: { eventId_phone: { eventId, phone } },
    select: { id: true, createdAt: true, quantity: true },
  });
  if (!entry) return undefined;
  return placeOf(eventId, entry.id, entry.createdAt, entry.quantity);
}

export async function leaveWaitlist(
  eventId: string,
  rawPhone: string,
): Promise<{ left: boolean }> {
  const { count } = await db.waitlistEntry.deleteMany({
    where: { eventId, phone: normalizeMobile(rawPhone) },
  });
  return { left: count > 0 };
}

/** Organiser view: the queue, in order. */
export async function listWaitlist(eventId: string): Promise<
  {
    id: string;
    name: string;
    phone: string;
    quantity: number;
    position: number;
    notifiedAt?: string;
    createdAt: string;
  }[]
> {
  const rows = await db.waitlistEntry.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r, i) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    quantity: r.quantity,
    position: i + 1,
    notifiedAt: r.notifiedAt?.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * Tell the front of the queue that seats came back.
 *
 * Called when inventory is released — an order expired, failed or was
 * cancelled. Walks the queue in order, handing out the freed seats until they
 * run out, and stamps `notifiedAt` so the same release cannot message the same
 * person twice.
 *
 * **Never throws.** It runs inside the release path, and an SMS operator having
 * a bad afternoon must not roll back returning seats to sale.
 *
 * This notifies rather than reserves: holding inventory for someone who may
 * never open the message takes the seats off sale for everyone else. Whoever
 * acts first still wins, which is the honest version of a waitlist.
 */
export async function notifyWaitlist(
  eventId: string,
  freedSeats: number,
): Promise<{ notified: number }> {
  try {
    if (freedSeats <= 0) return { notified: 0 };

    const event = await db.event.findUnique({
      where: { id: eventId },
      select: { title: true, waitlist: true, status: true },
    });
    if (!event?.waitlist || event.status !== "PUBLISHED") {
      return { notified: 0 };
    }

    const gateway = smsGateway();
    if (!gateway.configured) return { notified: 0 };

    const queue = await db.waitlistEntry.findMany({
      where: { eventId, notifiedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, phone: true, quantity: true },
    });
    if (!queue.length) return { notified: 0 };

    const reached: string[] = [];
    let budget = freedSeats;
    for (const entry of queue) {
      if (budget <= 0) break;
      reached.push(entry.phone);
      budget -= entry.quantity;
    }
    if (!reached.length) return { notified: 0 };

    const text = waitlistOpeningText({
      eventTitle: event.title,
      eventId,
      appUrl: process.env.APP_URL || undefined,
    });

    /**
     * Marked in the same batches they are sent in.
     *
     * This was one `sendBulk` and `if (!sent.ok) return { notified: 0 }`, which
     * was exactly right while a send was all-or-nothing. It stopped being right
     * when `sendBulk` learned to batch: it now answers `{ ok: false, sent: 250 }`
     * for a run where a later batch failed, and 250 people had their turn
     * announced while not one of them was recorded as notified.
     *
     * They stay `notifiedAt: null`, so they sit at the head of the queue and
     * consume the freed-seat budget again on the next opening — texted twice,
     * billed twice, and the people behind them starved indefinitely.
     *
     * Sending batch by batch and recording each one that lands keeps the
     * database agreeing with the operator. Re-batching here is free: `sendBulk`
     * batches internally too, so each of these is one request either way.
     */
    let notified = 0;
    for (const batch of inBatches(reached)) {
      const sent = await gateway.sendBulk(batch, text);
      if (!sent.ok) break; // A failing operator will fail the next batch too.
      await db.waitlistEntry.updateMany({
        where: { eventId, phone: { in: batch } },
        data: { notifiedAt: new Date() },
      });
      notified += batch.length;
    }
    return { notified };
  } catch (error) {
    console.error("[waitlist] notify failed", eventId, error);
    return { notified: 0 };
  }
}
