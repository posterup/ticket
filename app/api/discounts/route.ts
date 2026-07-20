import { NextResponse } from "next/server";

import { createDiscount, listDiscounts } from "@/lib/server";
import type {
  ApiResponse,
  CreateDiscountInput,
  DiscountCode,
  DiscountKind,
} from "@/types";

const KINDS: readonly DiscountKind[] = ["percent", "fixed"];

/** GET /api/discounts — list codes, optionally scoped by `?eventId=`. */
export function GET(request: Request): NextResponse<ApiResponse<DiscountCode[]>> {
  const eventId = new URL(request.url).searchParams.get("eventId") ?? undefined;
  return NextResponse.json({ data: listDiscounts(eventId) });
}

/** POST /api/discounts — create a discount code. 400 on invalid body. */
export async function POST(
  request: Request,
): Promise<NextResponse<ApiResponse<DiscountCode>>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Request body must be valid JSON.", code: "INVALID_JSON" } },
      { status: 400 },
    );
  }

  const input = parseCreateDiscountInput(body);
  if (input === null) {
    return NextResponse.json(
      { error: { message: "Invalid discount payload.", code: "INVALID_BODY" } },
      { status: 400 },
    );
  }

  // Reject a duplicate code (case-insensitive).
  if (listDiscounts().some((d) => d.code === input.code.trim().toUpperCase())) {
    return NextResponse.json(
      { error: { message: "این کد قبلاً ثبت شده است.", code: "DUPLICATE" } },
      { status: 409 },
    );
  }

  return NextResponse.json({ data: createDiscount(input) }, { status: 201 });
}

function parseCreateDiscountInput(body: unknown): CreateDiscountInput | null {
  if (typeof body !== "object" || body === null) return null;
  const c = body as Record<string, unknown>;

  const eventId =
    c.eventId === null || typeof c.eventId === "string" ? (c.eventId as string | null) : undefined;
  if (eventId === undefined) return null;

  const sessionId =
    c.sessionId === undefined || c.sessionId === null || typeof c.sessionId === "string"
      ? ((c.sessionId ?? null) as string | null)
      : undefined;
  if (sessionId === undefined) return null;

  if (typeof c.code !== "string" || !/^[A-Za-z0-9]{3,20}$/.test(c.code.trim())) return null;
  if (typeof c.kind !== "string" || !KINDS.includes(c.kind as DiscountKind)) return null;

  const value = c.value;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) return null;
  if (c.kind === "percent" && value > 100) return null;

  const maxRedemptions =
    c.maxRedemptions === null
      ? null
      : typeof c.maxRedemptions === "number" &&
          Number.isInteger(c.maxRedemptions) &&
          c.maxRedemptions > 0
        ? c.maxRedemptions
        : undefined;
  if (maxRedemptions === undefined) return null;

  const expiresAt =
    c.expiresAt === null
      ? null
      : typeof c.expiresAt === "string"
        ? c.expiresAt
        : undefined;
  if (expiresAt === undefined) return null;

  return {
    eventId,
    sessionId,
    code: c.code.trim().toUpperCase(),
    kind: c.kind as DiscountKind,
    value,
    maxRedemptions,
    expiresAt,
  };
}
