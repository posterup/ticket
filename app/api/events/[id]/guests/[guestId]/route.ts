import { NextResponse } from "next/server";

import { setGuestStatus, removeGuest } from "@/lib/server";
import type { ApiResponse, EventGuest, GuestRsvp } from "@/types";

const STATUSES: readonly GuestRsvp[] = ["pending", "going", "declined"];

/** PATCH /api/events/:id/guests/:guestId — set RSVP status. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ guestId: string }> },
): Promise<NextResponse<ApiResponse<EventGuest>>> {
  const { guestId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Request body must be valid JSON.", code: "INVALID_JSON" } },
      { status: 400 },
    );
  }

  const status = (body as Record<string, unknown>).status;
  if (typeof status !== "string" || !STATUSES.includes(status as GuestRsvp)) {
    return NextResponse.json(
      { error: { message: "Invalid status.", code: "INVALID_BODY" } },
      { status: 400 },
    );
  }

  const guest = setGuestStatus(guestId, status as GuestRsvp);
  if (guest === undefined) {
    return NextResponse.json(
      { error: { message: "Guest not found.", code: "NOT_FOUND" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ data: guest });
}

/** DELETE /api/events/:id/guests/:guestId — remove a guest. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ guestId: string }> },
): Promise<NextResponse<ApiResponse<{ id: string }>>> {
  const { guestId } = await params;
  if (!removeGuest(guestId)) {
    return NextResponse.json(
      { error: { message: "Guest not found.", code: "NOT_FOUND" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ data: { id: guestId } });
}
