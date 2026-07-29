import { createDiscount, listDiscounts } from "@/lib/server";
import { handler, HttpError, ok, readJson, readQuery } from "@/lib/server/http";
import {
  createDiscountSchema,
  listDiscountsQuery,
} from "@/lib/server/schemas/discount";

/** GET /api/discounts — list codes, optionally scoped by `?eventId=`. */
export const GET = handler(async (request: Request) => {
  const { eventId } = readQuery(request, listDiscountsQuery);
  return ok(await listDiscounts(eventId));
});

/** POST /api/discounts — create a discount code. 409 when the code is taken. */
export const POST = handler(async (request: Request) => {
  // The schema has already trimmed and upper-cased `code`.
  const input = await readJson(request, createDiscountSchema);

  if ((await listDiscounts()).some((d) => d.code === input.code)) {
    throw new HttpError(409, "DUPLICATE", "این کد قبلاً ثبت شده است.");
  }

  return ok(await createDiscount(input), 201);
});
