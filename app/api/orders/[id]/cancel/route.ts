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
/**
 * The buyer's phone, from the request body.
 *
 * Not the query string, which is where both of these used to read it. A phone
 * number in a URL is written to the server's access log, kept in the browser's
 * history, and sent to third parties in `Referer` — and it is the credential
 * that stands in for a session on a guest order, so it is exactly the thing
 * that must not end up there.
 *
 * A missing or unparseable body is not an error: a signed-in buyer proves
 * ownership with their session and sends nothing.
 */
async function provenPhone(request: Request): Promise<string | null> {
  try {
    const body = (await request.json()) as { phone?: unknown };
    return typeof body?.phone === "string" ? body.phone : null;
  } catch {
    return null;
  }
}

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

  const phone = await provenPhone(request);
  const owns = user && row?.userId === user.id;
  const proves = phone && phone === order.buyerPhone;
  if (!owns && !proves) {
    throw new HttpError(403, "FORBIDDEN", "به این سفارش دسترسی ندارید.");
  }

  return ok((await cancelOrder(id))!);
});
