import { NextResponse } from "next/server";

import { setCheckin } from "@/lib/server";
import type { ApiResponse } from "@/types";

/** POST /api/checkin — record or clear a holder's check-in. */
export async function POST(
  request: Request,
): Promise<NextResponse<ApiResponse<{ holderId: string; checked: boolean }>>> {
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
      { error: { message: "Invalid body.", code: "INVALID_BODY" } },
      { status: 400 },
    );
  }
  const { holderId, checked } = body as Record<string, unknown>;
  if (typeof holderId !== "string" || !holderId || typeof checked !== "boolean") {
    return NextResponse.json(
      { error: { message: "holderId (string) and checked (boolean) are required.", code: "INVALID_BODY" } },
      { status: 400 },
    );
  }

  setCheckin(holderId, checked);
  return NextResponse.json({ data: { holderId, checked } }, { status: 200 });
}
