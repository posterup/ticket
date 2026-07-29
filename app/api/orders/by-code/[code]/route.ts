import { getOrderByCode } from "@/lib/server";
import { getCurrentUser } from "@/lib/server/auth/guards";
import { db } from "@/lib/server/db";
import { handler, notFound, ok } from "@/lib/server/http";

type Context = { params: Promise<{ code: string }> };

/**
 * GET /api/orders/by-code/:code — an order by its tracking code.
 *
 * Keyed by code rather than id because a guest checkout has no account to look
 * it up under; the code is what the buyer is given.
 */
export const GET = handler(async (_r: Request, { params }: Context) => {
  const { code } = await params;
  const order = await getOrderByCode(code);
  if (!order) throw notFound("سفارش یافت نشد.");

  // The code is unguessable and the buyer needs this without an account, so
  // the order itself is readable — but the page never shows the phone number,
  // and anyone holding a forwarded link would otherwise get it.
  const user = await getCurrentUser();
  const owned = user
    ? (await db.order.findUnique({
        where: { id: order.id },
        select: { userId: true },
      }))?.userId === user.id
    : false;

  return ok(owned ? order : { ...order, buyerPhone: "" });
});
