import { createOrder } from "@/lib/server";
import { getCurrentUser } from "@/lib/server/auth/guards";
import { resolveHolderKey } from "@/lib/server/venues/holder";
import { handler, ok, readJson } from "@/lib/server/http";
import { createOrderSchema } from "@/lib/server/schemas/order";

/**
 * POST /api/orders — place an order, holding its seats.
 *
 * Open to guests: buying a ticket must not require an account. A signed-in
 * buyer gets the order attached to them so it appears under «بلیت‌های من».
 *
 * Prices, totals and discounts are all computed server-side. For assigned
 * seating the holder key decides whose seats these are, which is why it is
 * resolved here and not taken from the body.
 */
export const POST = handler(async (request: Request) => {
  const input = await readJson(request, createOrderSchema);
  const user = await getCurrentUser();
  const holderKey = input.seats?.length ? await resolveHolderKey() : undefined;

  const { order, requiresPayment } = await createOrder(input, {
    userId: user?.id,
    holderKey,
  });
  return ok({ order, requiresPayment }, 201);
});
