import { NextResponse } from "next/server";

import {
  getOrderById,
  markOrderPaid,
  releaseSeatInventory,
} from "@/lib/server";
import { db } from "@/lib/server/db";
import { paymentGateway } from "@/lib/server/payments";

/**
 * GET /api/payments/callback — where the gateway returns the buyer.
 *
 * Always redirects to the order page rather than returning JSON: a person is
 * arriving here in a browser, not a client calling an API.
 *
 * Safe to hit twice. `markOrderPaid` claims the order with a conditional
 * update, so a duplicate callback — or a back-button — settles nothing twice.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("order");
  const authority = url.searchParams.get("Authority");
  const status = url.searchParams.get("Status");

  // `||` not `??` — see the note in `orders/[id]/pay`.
  const base = process.env.APP_URL || url.origin;
  const back = (code: string, state?: string) =>
    NextResponse.redirect(
      `${base}/orders/${code}${state ? `?state=${state}` : ""}`,
      { status: 303 },
    );

  if (!orderId) return NextResponse.redirect(`${base}/`, { status: 303 });

  const order = await getOrderById(orderId);
  if (!order) return NextResponse.redirect(`${base}/`, { status: 303 });

  // The buyer abandoned the gateway, or it rejected the payment.
  if (status !== "OK" || !authority) {
    await releaseAndFail(orderId, authority);
    return back(order.code, "failed");
  }

  const gateway = paymentGateway();
  const verified = await gateway.verify({
    authority,
    amountToman: order.total,
  });

  if (!verified.ok) {
    await releaseAndFail(orderId, authority);
    return back(order.code, "failed");
  }

  /**
   * Past this point the money has moved.
   *
   * `gateway.verify` is a server-to-server confirmation with the operator, so
   * by the time it returns `ok` the buyer has been charged. `markOrderPaid` was
   * then called bare: a database blip, a constraint, anything at all, and this
   * handler threw a 500 at a person who had just paid — with the order still
   * `PENDING_PAYMENT`, so `releaseExpiredOrders` would later sweep it to
   * EXPIRED and hand their seats to someone else. Money taken, no ticket, and
   * the evidence tidied away by a background job.
   *
   * It cannot be retried here either: this is a browser redirect, and a buyer
   * who closes the tab never comes back.
   *
   * So the failure is caught, and `refId` — the operator's own reference, the
   * only key that reconciles this against their settlement report — is logged
   * with the order. The buyer is sent to their order page told that the payment
   * arrived and the ticket is being issued, which is true, rather than to a
   * stack trace.
   */
  try {
    await markOrderPaid(orderId, {
      provider: gateway.provider,
      authority,
      refId: verified.refId,
    });
  } catch (error) {
    console.error("[payments] PAID BUT NOT SETTLED — reconcile by hand", {
      orderId,
      code: order.code,
      provider: gateway.provider,
      authority,
      refId: verified.refId,
      amountToman: order.total,
      error,
    });
    return back(order.code, "settling");
  }
  return back(order.code);
}

/** Mark the attempt failed and let the seats go. */
async function releaseAndFail(
  orderId: string,
  authority: string | null,
): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  if (order?.status !== "PENDING_PAYMENT") return;

  // Assigned seats go back on sale now, not when their hold lapses — a buyer
  // whose card was declined should not take two rows off the market for twenty
  // minutes. Shared with cancellation and the expiry sweep.
  await releaseSeatInventory(orderId);

  const items = await db.orderItem.findMany({ where: { orderId } });
  await db.$transaction([
    ...items.map((item) =>
      db.ticketType.update({
        where: { id: item.ticketTypeId },
        data: { reserved: { decrement: item.quantity } },
      }),
    ),
    db.order.update({ where: { id: orderId }, data: { status: "FAILED" } }),
    ...(authority
      ? [
          db.payment.updateMany({
            where: { orderId, authority },
            data: { status: "FAILED" },
          }),
        ]
      : []),
  ]);
}
