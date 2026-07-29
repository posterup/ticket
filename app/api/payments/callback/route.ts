import { NextResponse } from "next/server";

import { getOrderById, markOrderPaid } from "@/lib/server";
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

  const base = process.env.APP_URL ?? url.origin;
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

  await markOrderPaid(orderId, {
    provider: gateway.provider,
    authority,
    refId: verified.refId,
  });
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
