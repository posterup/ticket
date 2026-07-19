import { NextResponse } from "next/server";

import { createEvent, listEvents } from "@/lib/server";
import type {
  ApiResponse,
  CreateEventInput,
  Event,
  EventMode,
} from "@/types";

const EVENT_MODES: readonly EventMode[] = [
  "one-time",
  "recurring",
  "multi-session",
];

/** GET /api/events — list all events. */
export function GET(): NextResponse<ApiResponse<Event[]>> {
  return NextResponse.json({ data: listEvents() });
}

/** POST /api/events — create an event. 400 on invalid body, 201 on success. */
export async function POST(
  request: Request,
): Promise<NextResponse<ApiResponse<Event>>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Request body must be valid JSON.", code: "INVALID_JSON" } },
      { status: 400 },
    );
  }

  const input = parseCreateEventInput(body);
  if (input === null) {
    return NextResponse.json(
      {
        error: {
          message: "Missing or invalid fields: title, description, mode, venue, sessions.",
          code: "INVALID_BODY",
        },
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ data: createEvent(input) }, { status: 201 });
}

/** Minimal, dependency-free validation of the event creation payload. */
function parseCreateEventInput(body: unknown): CreateEventInput | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const candidate = body as Record<string, unknown>;

  const { title, description, mode, venue, sessions } = candidate;

  if (typeof title !== "string" || title.trim() === "") return null;
  if (typeof description !== "string") return null;
  if (typeof mode !== "string" || !EVENT_MODES.includes(mode as EventMode)) {
    return null;
  }
  if (typeof venue !== "object" || venue === null) return null;
  if (!Array.isArray(sessions) || sessions.length === 0) return null;

  return candidate as unknown as CreateEventInput;
}
