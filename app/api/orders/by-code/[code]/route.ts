import { getOrderByCode } from "@/lib/server";
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
  return ok(order);
});
