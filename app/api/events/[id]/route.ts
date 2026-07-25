import { NextResponse } from "next/server";

import { getEventById, updateEvent, type EventUpdate } from "@/lib/server";
import type {
  ApiResponse,
  Event,
  EventStatus,
  RecurrenceFrequency,
  RecurrenceRule,
  WeekDay,
} from "@/types";

const EVENT_STATUSES: readonly EventStatus[] = [
  "draft",
  "published",
  "cancelled",
  "completed",
];

const FREQUENCIES: readonly RecurrenceFrequency[] = [
  "daily",
  "weekly",
  "monthly",
  "weekday",
];

const WEEKDAYS: readonly WeekDay[] = [
  "SA",
  "SU",
  "MO",
  "TU",
  "WE",
  "TH",
  "FR",
];

/** Validate a recurrence rule payload, returning a clean rule or `null`. */
function parseRecurrence(value: unknown): RecurrenceRule | null {
  if (typeof value !== "object" || value === null) return null;
  const r = value as Record<string, unknown>;

  if (!FREQUENCIES.includes(r.frequency as RecurrenceFrequency)) return null;
  if (
    typeof r.interval !== "number" ||
    !Number.isInteger(r.interval) ||
    r.interval < 1
  ) {
    return null;
  }

  const rule: RecurrenceRule = {
    frequency: r.frequency as RecurrenceFrequency,
    interval: r.interval,
  };

  if ("byDay" in r && r.byDay !== undefined) {
    if (
      !Array.isArray(r.byDay) ||
      !r.byDay.every((d) => WEEKDAYS.includes(d as WeekDay))
    ) {
      return null;
    }
    if (r.byDay.length > 0) rule.byDay = r.byDay as WeekDay[];
  }
  if ("count" in r && r.count !== undefined) {
    if (typeof r.count !== "number" || !Number.isInteger(r.count) || r.count < 1) {
      return null;
    }
    rule.count = r.count;
  }
  if ("until" in r && r.until !== undefined) {
    if (typeof r.until !== "string" || r.until.trim() === "") return null;
    rule.until = r.until;
  }

  return rule;
}

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
  if ("visibility" in c) {
    if (
      c.visibility !== "public" &&
      c.visibility !== "link" &&
      c.visibility !== "audience"
    ) {
      return null;
    }
    patch.visibility = c.visibility;
  }
  if ("audienceTags" in c) {
    if (
      !Array.isArray(c.audienceTags) ||
      !c.audienceTags.every((t) => typeof t === "string")
    ) {
      return null;
    }
    patch.audienceTags = c.audienceTags as string[];
  }
  if ("requiresApproval" in c) {
    if (typeof c.requiresApproval !== "boolean") return null;
    patch.requiresApproval = c.requiresApproval;
  }
  if ("slug" in c) {
    if (typeof c.slug !== "string" || c.slug.trim() === "") return null;
    patch.slug = c.slug.trim();
  }
  if ("recurrence" in c) {
    const rule = parseRecurrence(c.recurrence);
    if (rule === null) return null;
    patch.recurrence = rule;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}
