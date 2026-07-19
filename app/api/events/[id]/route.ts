import { NextResponse } from "next/server";

import { getEventById } from "@/lib/server";
import type { ApiResponse, Event } from "@/types";

/** GET /api/events/:id — fetch one event. 404 when it does not exist. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<Event>>> {
  const { id } = await params;
  const event = getEventById(id);

  if (event === undefined) {
    return NextResponse.json(
      { error: { message: `Event "${id}" was not found.`, code: "NOT_FOUND" } },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: event });
}
