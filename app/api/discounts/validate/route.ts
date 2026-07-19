import { NextResponse } from "next/server";

import { validateDiscount } from "@/lib/server";
import type { ApiResponse, DiscountValidation } from "@/types";

/**
 * POST /api/discounts/validate — check a promo code against an order.
 * Body: `{ code: string, eventId: string, subtotal: number }`.
 * Always 200 with a {@link DiscountValidation} (discriminated on `ok`);
 * 400 only when the request body itself is malformed.
 */
export async function POST(
  request: Request,
): Promise<NextResponse<ApiResponse<DiscountValidation>>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Request body must be valid JSON.", code: "INVALID_JSON" } },
      { status: 400 },
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: { message: "Missing fields: code, eventId, subtotal.", code: "INVALID_BODY" } },
      { status: 400 },
    );
  }

  const { code, eventId, subtotal } = body as Record<string, unknown>;
  if (
    typeof code !== "string" ||
    typeof eventId !== "string" ||
    typeof subtotal !== "number" ||
    !Number.isFinite(subtotal)
  ) {
    return NextResponse.json(
      { error: { message: "Missing fields: code, eventId, subtotal.", code: "INVALID_BODY" } },
      { status: 400 },
    );
  }

  return NextResponse.json({ data: validateDiscount(code, eventId, subtotal) });
}
