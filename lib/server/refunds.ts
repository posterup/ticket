/**
 * Unwinding a sale.
 *
 * `REFUNDED` has existed on both `OrderStatus` and `TicketStatus` since the
 * schema was written and nothing has ever set either one. That was tolerable
 * while nothing could cancel a show; it stopped being tolerable the moment
 * cancellation started texting buyers that their money would come back, because
 * the platform had no way to record that it ever did.
 *
 * **The money is manual.** Iranian gateways settle to the organiser, not to us,
 * so there is no API here that moves rials — the organiser transfers it. What
 * this owns is the *record and the consequences*: the order stops being a sale,
 * the tickets stop admitting anyone, the seats go back on sale, and the person
 * waiting in the queue gets told. Those are the parts that silently rot if
 * refunds live only in a spreadsheet.
 *
 * Precisely the inverse of the transaction in `markOrderPaid`, in the same
 * order, so the two can be read against each other.
 */

import { db } from "@/lib/server/db";
import { HttpError, notFound } from "@/lib/server/http";
import { smsGateway } from "@/lib/server/sms";
import { formatToman } from "@/lib/format";

import { notifyWaitlist } from "./waitlist";

export interface RefundResult {
  orderId: string;
  code: string;
  amount: number;
  /** Tickets voided. */
  tickets: number;
  /** Assigned seats returned to the pool. */
  seats: number;
  buyerNotified: boolean;
}

/**
 * Refund one paid order.
 *
 * Refuses anything that is not `PAID`: refunding an expired or already-refunded
 * order would decrement `sold` a second time and quietly corrupt every capacity
 * number derived from it.
 *
 * Checked-in tickets do not block it — someone can be admitted and still be
 * owed their money when the second half of a show is cancelled — but they are
 * reported, because an organiser refunding a guest who already walked in should
 * know that is what they are doing.
 */
export async function refundOrder(
  orderId: string,
  options: { reason?: string; notify?: boolean } = {},
): Promise<RefundResult> {
  // `reason` is logged, not stored: `Order` has no free-text column and adding
  // one for an audit note is a migration this change does not need. It is here
  // because the call sites already know why, and losing that at the boundary
  // would mean inventing it again later.
  if (options.reason) {
    console.info(`[refund] ${orderId}: ${options.reason}`);
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      code: true,
      status: true,
      total: true,
      eventId: true,
      buyerPhone: true,
      event: { select: { title: true } },
      items: { select: { ticketTypeId: true, quantity: true } },
    },
  });
  if (!order) throw notFound("سفارش پیدا نشد.");

  if (order.status !== "PAID") {
    throw new HttpError(
      409,
      "CONFLICT",
      "فقط سفارش پرداخت‌شده را می‌توان بازپرداخت کرد.",
    );
  }

  const seats = await db.seatStatus.count({ where: { orderId } });
  const tickets = await db.ticket.count({ where: { orderId } });

  await db.$transaction([
    // Give the inventory back. `sold` is decremented, not `reserved`: the hold
    // became a sale at settlement and there is no hold left to release.
    ...order.items.map((item) =>
      db.ticketType.update({
        where: { id: item.ticketTypeId },
        data: { sold: { decrement: item.quantity } },
      }),
    ),
    // The tickets stop admitting anyone. Kept rather than deleted so the
    // qrToken still resolves at the door — to a refused scan with a reason,
    // which is far better than "unknown code" for someone holding a phone.
    db.ticket.updateMany({
      where: { orderId },
      data: { status: "REFUNDED" },
    }),
    // Assigned seats return to the pool. Sparse by design: deleting the row is
    // what makes the seat available again.
    db.seatStatus.deleteMany({ where: { orderId } }),
    db.order.update({ where: { id: orderId }, data: { status: "REFUNDED" } }),
  ]);

  // Someone is waiting for exactly these seats.
  const quantity = order.items.reduce((sum, i) => sum + i.quantity, 0);
  void notifyWaitlist(order.eventId, quantity);

  let buyerNotified = false;
  if (options.notify !== false) {
    buyerNotified = await tellBuyer(
      order.buyerPhone,
      order.event.title,
      order.total,
      order.code,
    );
  }

  return {
    orderId: order.id,
    code: order.code,
    amount: order.total,
    tickets,
    seats,
    buyerNotified,
  };
}

/** Never throws: a refund that happened must not be reported as failed. */
async function tellBuyer(
  phone: string,
  title: string,
  total: number,
  code: string,
): Promise<boolean> {
  try {
    const gateway = smsGateway();
    if (!gateway.configured || !phone) return false;
    const result = await gateway.sendBulk(
      [phone],
      `بازپرداخت ثبت شد ↩️\n` +
        `${title}\n` +
        `${formatToman(total)} به شما بازگردانده می‌شود.\n` +
        `کد پیگیری: ${code}`,
    );
    return result.ok;
  } catch (error) {
    console.error("[refund] buyer notice failed", code, error);
    return false;
  }
}

export interface RefundCandidate {
  orderId: string;
  code: string;
  buyerName: string;
  buyerPhone: string;
  total: number;
  tickets: number;
  sessionLabel?: string;
  /** Already admitted — refunding is still allowed, but worth flagging. */
  checkedIn: number;
}

/**
 * The orders a cancellation left owing money.
 *
 * Cancelling a show is one click; making a hundred buyers whole is not. Without
 * this the organiser is left to reconstruct who is owed what from the orders
 * list, which is how people get missed.
 */
export async function refundQueue(
  eventId: string,
  sessionId?: string,
): Promise<RefundCandidate[]> {
  const orders = await db.order.findMany({
    where: {
      eventId,
      status: "PAID",
      ...(sessionId ? { sessionId } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      code: true,
      buyerName: true,
      buyerPhone: true,
      total: true,
      session: { select: { startAt: true } },
      items: { select: { quantity: true } },
      tickets: { select: { status: true } },
    },
  });

  return orders.map((o) => ({
    orderId: o.id,
    code: o.code,
    buyerName: o.buyerName,
    buyerPhone: o.buyerPhone,
    total: o.total,
    tickets: o.items.reduce((sum, i) => sum + i.quantity, 0),
    sessionLabel: o.session?.startAt.toISOString(),
    checkedIn: o.tickets.filter((t) => t.status === "CHECKED_IN").length,
  }));
}
