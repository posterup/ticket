import { cancelOrder, getOrderById } from "@/lib/server";
import { getCurrentUser } from "@/lib/server/auth/guards";
import { handler, HttpError, notFound, ok } from "@/lib/server/http";

type Context = { params: Promise<{ id: string }> };

/**
 * POST /api/orders/:id/cancel — abandon an order and release its seats.
 *
 * Guests have no session, so the buyer's phone stands in as proof: a caller
 * must either own the order or quote the number it was placed with.
 */
export const POST = handler(async (request: Request, { params }: Context) => {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) throw notFound("سفارش یافت نشد.");

  const user = await getCurrentUser();
  const { db } = await import("@/lib/server/db");
  const row = await db.order.findUnique({
    where: { id },
    select: { userId: true },
  });

  const phone = new URL(request.url).searchParams.get("phone");
  const owns = user && row?.userId === user.id;
  const proves = phone && phone === order.buyerPhone;
  if (!owns && !proves) {
    throw new HttpError(403, "FORBIDDEN", "به این سفارش دسترسی ندارید.");
  }

  return ok((await cancelOrder(id))!);
});
