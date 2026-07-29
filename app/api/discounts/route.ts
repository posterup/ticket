import { createDiscount, listDiscounts } from "@/lib/server";
import { requireEventAccess, requireManager } from "@/lib/server/auth/guards";
import { handler, HttpError, ok, readJson, readQuery } from "@/lib/server/http";
import {
  createDiscountSchema,
  listDiscountsQuery,
} from "@/lib/server/schemas/discount";

/**
 * GET /api/discounts — list codes for an event you manage.
 *
 * `eventId` is required: without it this would hand every code in the system
 * to any caller, which is precisely what it used to do.
 */
export const GET = handler(async (request: Request) => {
  const { eventId } = readQuery(request, listDiscountsQuery);
  if (!eventId) {
    throw new HttpError(400, "INVALID_QUERY", "eventId الزامی است.");
  }
  await requireEventAccess(eventId, "discounts:manage");
  return ok(await listDiscounts(eventId));
});

/** POST /api/discounts — create a discount code. 409 when the code is taken. */
export const POST = handler(async (request: Request) => {
  // The schema has already trimmed and upper-cased `code`.
  const input = await readJson(request, createDiscountSchema);

  if (input.eventId) {
    await requireEventAccess(input.eventId, "discounts:manage");
  } else {
    // An org-wide code applies to every event of the workspace, so managing
    // any workspace at all is the minimum bar.
    await requireManager();
  }

  if ((await listDiscounts()).some((d) => d.code === input.code)) {
    throw new HttpError(409, "DUPLICATE", "این کد قبلاً ثبت شده است.");
  }

  return ok(await createDiscount(input), 201);
});
