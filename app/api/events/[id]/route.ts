import { NextResponse } from "next/server";

import { getEventById, updateEvent, type EventUpdate } from "@/lib/server";
import type { ApiResponse, Event, EventStatus } from "@/types";

const EVENT_STATUSES: readonly EventStatus[] = [
  "draft",
  "published",
  "cancelled",
  "completed",
];

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

/** PATCH /api/events/:id — edit title/description/status. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<Event>>> {
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

  const patch = parseEventUpdate(body);
  if (patch === null) {
    return NextResponse.json(
      { error: { message: "No valid fields to update.", code: "INVALID_BODY" } },
      { status: 400 },
    );
  }

  const event = updateEvent(id, patch);
  if (event === undefined) {
    return NextResponse.json(
      { error: { message: `Event "${id}" was not found.`, code: "NOT_FOUND" } },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: event });
}

/** Validate the event patch, keeping only known, well-typed fields. */
function parseEventUpdate(body: unknown): EventUpdate | null {
  if (typeof body !== "object" || body === null) return null;
  const c = body as Record<string, unknown>;
  const patch: EventUpdate = {};

  if ("title" in c) {
    if (typeof c.title !== "string" || c.title.trim() === "") return null;
    patch.title = c.title.trim();
  }
  if ("description" in c) {
    if (typeof c.description !== "string") return null;
    patch.description = c.description;
  }
  if ("status" in c) {
    if (typeof c.status !== "string" || !EVENT_STATUSES.includes(c.status as EventStatus)) {
      return null;
    }
    patch.status = c.status as EventStatus;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}
