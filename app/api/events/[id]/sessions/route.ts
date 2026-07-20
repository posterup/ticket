import { NextResponse } from "next/server";

import { addSession } from "@/lib/server";
import type { ApiResponse, EventSession } from "@/types";

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?Z?$/;

/** POST /api/events/:id/sessions — add a new سانس (startAt/endAt). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<EventSession>>> {
  const { id } = await params;

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
  const { startAt, endAt } = body as Record<string, unknown>;
  if (
    typeof startAt !== "string" ||
    !ISO.test(startAt) ||
    typeof endAt !== "string" ||
    !ISO.test(endAt) ||
    endAt < startAt
  ) {
    return NextResponse.json(
      { error: { message: "startAt/endAt are required and must be valid.", code: "INVALID_BODY" } },
      { status: 400 },
    );
  }

  const session = addSession(id, { startAt, endAt });
  if (session === undefined) {
    return NextResponse.json(
      { error: { message: `Event "${id}" was not found.`, code: "NOT_FOUND" } },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: session }, { status: 201 });
}
