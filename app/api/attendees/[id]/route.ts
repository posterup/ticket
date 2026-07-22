import { NextResponse } from "next/server";

import { setAttendeeTags } from "@/lib/server";
import type { ApiResponse, Attendee } from "@/types";

/** PATCH /api/attendees/:id — replace a contact's tags (string labels). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<Attendee>>> {
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

  const tags = (body as Record<string, unknown>).tags;
  if (!Array.isArray(tags) || tags.some((t) => typeof t !== "string")) {
    return NextResponse.json(
      { error: { message: "tags must be an array of strings.", code: "INVALID_BODY" } },
      { status: 400 },
    );
  }

  const attendee = setAttendeeTags(id, tags as string[]);
  if (attendee === undefined) {
    return NextResponse.json(
      { error: { message: "Contact not found.", code: "NOT_FOUND" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ data: attendee });
}
