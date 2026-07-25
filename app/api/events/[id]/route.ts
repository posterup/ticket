import { NextResponse } from "next/server";

import { getEventById, updateEvent, type EventUpdate } from "@/lib/server";
import type {
  ApiResponse,
  Event,
  EventStatus,
  RecurrenceSchedule,
  ScheduleSlot,
  WeekDay,
} from "@/types";

const EVENT_STATUSES: readonly EventStatus[] = [
  "draft",
  "published",
  "cancelled",
  "completed",
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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

/** Validate one سانس time-slot, returning a clean slot or `null`. */
function parseSlot(value: unknown): ScheduleSlot | null {
  if (typeof value !== "object" || value === null) return null;
  const s = value as Record<string, unknown>;
  if (typeof s.id !== "string" || s.id === "") return null;
  if (typeof s.startTime !== "string" || !TIME_RE.test(s.startTime)) return null;
  const endTime =
    typeof s.endTime === "string" && TIME_RE.test(s.endTime)
      ? s.endTime
      : s.startTime;
  return { id: s.id, startTime: s.startTime, endTime };
}

/** Validate a calendar-schedule payload, returning a clean spec or `null`. */
function parseRecurrenceSchedule(value: unknown): RecurrenceSchedule | null {
  if (typeof value !== "object" || value === null) return null;
  const r = value as Record<string, unknown>;

  if (typeof r.startDate !== "string" || !DATE_RE.test(r.startDate)) return null;
  const endDate =
    typeof r.endDate === "string" && DATE_RE.test(r.endDate)
      ? r.endDate
      : r.startDate;

  if (
    !Array.isArray(r.byDay) ||
    !r.byDay.every((d) => WEEKDAYS.includes(d as WeekDay))
  ) {
    return null;
  }
  if (!Array.isArray(r.slots)) return null;
  const slots = r.slots.map(parseSlot);
  if (slots.some((s) => s === null) || slots.length === 0) return null;

  const exceptions =
    Array.isArray(r.exceptions) &&
    r.exceptions.every((d) => typeof d === "string" && DATE_RE.test(d))
      ? (r.exceptions as string[])
      : [];

  const spec: RecurrenceSchedule = {
    startDate: r.startDate,
    endDate,
    byDay: r.byDay as WeekDay[],
    slots: slots as ScheduleSlot[],
    exceptions,
  };

  if ("daySlots" in r && r.daySlots && typeof r.daySlots === "object") {
    const out: Partial<Record<WeekDay, ScheduleSlot[]>> = {};
    for (const [day, arr] of Object.entries(r.daySlots as object)) {
      if (!WEEKDAYS.includes(day as WeekDay) || !Array.isArray(arr)) continue;
      const parsed = arr.map(parseSlot);
      if (parsed.some((s) => s === null)) return null;
      if (parsed.length > 0) out[day as WeekDay] = parsed as ScheduleSlot[];
    }
    if (Object.keys(out).length > 0) spec.daySlots = out;
  }

  return spec;
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
  if ("recurrenceSchedule" in c) {
    const spec = parseRecurrenceSchedule(c.recurrenceSchedule);
    if (spec === null) return null;
    patch.recurrenceSchedule = spec;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}
