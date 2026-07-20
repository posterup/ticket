import { NextResponse } from "next/server";

import { updateSession, type SessionUpdate } from "@/lib/server";
import type { ApiResponse, EventSession } from "@/types";

/**
 * PATCH /api/events/:id/sessions/:sessionId — reschedule a سانس (startAt/endAt)
 * or cancel/restore it (`cancelled`). Any subset of fields may be sent.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> },
): Promise<NextResponse<ApiResponse<EventSession>>> {
  const { id, sessionId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Request body must be valid JSON.", code: "INVALID_JSON" } },
      { status: 400 },
    );
  }

  const patch = parseSessionUpdate(body);
  if (patch === null) {
    return NextResponse.json(
      { error: { message: "No valid fields to update.", code: "INVALID_BODY" } },
      { status: 400 },
    );
  }

  const session = updateSession(id, sessionId, patch);
  if (session === undefined) {
    return NextResponse.json(
      { error: { message: "Session was not found.", code: "NOT_FOUND" } },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: session });
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?Z?$/;

/** Validate the session patch, keeping only known, well-typed fields. */
function parseSessionUpdate(body: unknown): SessionUpdate | null {
  if (typeof body !== "object" || body === null) return null;
  const c = body as Record<string, unknown>;
  const patch: SessionUpdate = {};

  if ("startAt" in c) {
    if (typeof c.startAt !== "string" || !ISO.test(c.startAt)) return null;
    patch.startAt = c.startAt;
  }
  if ("endAt" in c) {
    if (typeof c.endAt !== "string" || !ISO.test(c.endAt)) return null;
    patch.endAt = c.endAt;
  }
  if ("cancelled" in c) {
    if (typeof c.cancelled !== "boolean") return null;
    patch.cancelled = c.cancelled;
  }

  // Reject an end that precedes the start when both are provided.
  if (patch.startAt && patch.endAt && patch.endAt < patch.startAt) return null;

  return Object.keys(patch).length > 0 ? patch : null;
}
