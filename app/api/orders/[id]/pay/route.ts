import { getOrderById } from "@/lib/server";
import { getCurrentUser } from "@/lib/server/auth/guards";
import { db } from "@/lib/server/db";
import { handler, HttpError, notFound, ok } from "@/lib/server/http";
import { paymentGateway } from "@/lib/server/payments";

type Context = { params: Promise<{ id: string }> };

/** Where the gateway sends the buyer back. */
function callbackUrl(request: Request, orderId: string): string {
  const base =
    process.env.APP_URL ?? new URL(request.url).origin;
  return `${base}/api/payments/callback?order=${orderId}`;
}

/**
 * POST /api/orders/:id/pay — start payment, returning where to send the buyer.
 *
 * Not a redirect: the client navigates, so it can handle a failure inline
 * rather than landing on an error page.
 */
export const POST = handler(async (request: Request, { params }: Context) => {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) throw notFound("سفارش یافت نشد.");

  // The same proof `/cancel` asks for. Guest checkout has no session, so the
  // buyer's phone stands in; without either, a stranger holding an order id
  // could open payment attempts against it.
  const user = await getCurrentUser();
  const row = await db.order.findUnique({
    where: { id },
    select: { userId: true },
  });
  const phone = new URL(request.url).searchParams.get("phone");
  if (!(user && row?.userId === user.id) && phone !== order.buyerPhone) {
    throw new HttpError(403, "FORBIDDEN", "به این سفارش دسترسی ندارید.");
  }

  if (order.status !== "pending-payment") {
    throw new HttpError(409, "CONFLICT", "این سفارش قابل پرداخت نیست.");
  }
  if (new Date(order.expiresAt).getTime() < Date.now()) {
    throw new HttpError(409, "CONFLICT", "مهلت پرداخت این سفارش گذشته است.");
  }

  const gateway = paymentGateway();
  const fail = new URL(request.url).searchParams.get("fail") === "1";
  const result = await gateway.request({
    orderId: order.id,
    amountToman: order.total,
    // The mock reads this marker to exercise the failure path.
    description: `سفارش ${order.code}${fail ? " [fail]" : ""}`,
    callbackUrl: callbackUrl(request, order.id),
    mobile: order.buyerPhone,
  });

  if (!result.ok) {
    throw new HttpError(502, "PAYMENT_FAILED", result.message);
  }

  await db.payment.create({
    data: {
      orderId: order.id,
      provider: gateway.provider,
      amount: order.total,
      authority: result.authority,
      status: "REDIRECTED",
    },
  });

  return ok({ redirectUrl: result.redirectUrl, authority: result.authority });
});
