import { NextResponse } from "next/server";

import { addGuest, listGuests } from "@/lib/server";
import type { ApiResponse, EventGuest } from "@/types";

/** GET /api/events/:id/guests — list an event's guests. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<EventGuest[]>>> {
  const { id } = await params;
  return NextResponse.json({ data: listGuests(id) });
}

/** POST /api/events/:id/guests — invite a guest by phone or email. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<EventGuest>>> {
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

  const c = body as Record<string, unknown>;
  const contact = typeof c.contact === "string" ? c.contact.trim() : "";
  const channel = c.channel === "email" ? "email" : c.channel === "phone" ? "phone" : null;
  if (!contact || channel === null) {
    return NextResponse.json(
      { error: { message: "A contact and channel are required.", code: "INVALID_BODY" } },
      { status: 400 },
    );
  }

  return NextResponse.json({ data: addGuest(id, { contact, channel }) });
}
