import { validateDiscount } from "@/lib/server";
import { handler, ok, readJson } from "@/lib/server/http";
import { validateDiscountSchema } from "@/lib/server/schemas/discount";

/**
 * POST /api/discounts/validate — check a promo code against an order.
 * Always 200 with a `DiscountValidation` (discriminated on `ok`);
 * 400 only when the request body itself is malformed.
 */
export const POST = handler(async (request: Request) => {
  const { code, eventId, subtotal } = await readJson(
    request,
    validateDiscountSchema,
  );
  return ok(validateDiscount(code, eventId, subtotal));
});
