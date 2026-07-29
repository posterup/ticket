/**
 * Event data-access over Postgres.
 *
 * Reads always include the venue and sessions, because `Event` in `types/`
 * carries them inline — the wire shape is unchanged from the in-memory era.
 */

import type {
  CreateEventInput,
  Event,
  EventSession,
  RecurrenceSchedule,
  SessionAvailability,
  Venue,
} from "@/types";
import { expandSchedule, type ScheduleDraft } from "@/lib/create/types";
import { CALENDAR_MODE_ENABLED } from "@/lib/flags";

import { db } from "./db";
import { toEvent, toSession, toVenue, type EventRow } from "./mappers";
import {
  EVENT_MODE_TO_DB,
  EVENT_STATUS_TO_DB,
  EVENT_VISIBILITY_TO_DB,
  SESSION_AVAILABILITY_TO_DB,
} from "./mappers/enums";

/** Everything {@link toEvent} needs, with sessions in chronological order. */
const INCLUDE = {
  venue: true,
  sessions: { orderBy: { startAt: "asc" } },
} as const;

/**
 * Return every event, newest first. While calendar mode is disabled, recurring
 * (تقویمی) events are hidden from every listing so the mode leaves no trace;
 * direct lookups ({@link getEventById}) still resolve them.
 */
export async function listEvents(): Promise<Event[]> {
  const rows = await db.event.findMany({
    where: CALENDAR_MODE_ENABLED ? undefined : { mode: { not: "RECURRING" } },
    include: INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => toEvent(row as EventRow));
}

/**
 * Events any visitor may see: published, and not restricted to a link or an
 * audience. This is what the public API returns — {@link listEvents} includes
 * drafts and is for callers that have already proven access.
 */
export async function listPublicEvents(): Promise<Event[]> {
  const rows = await db.event.findMany({
    where: {
      status: "PUBLISHED",
      visibility: "PUBLIC",
      ...(CALENDAR_MODE_ENABLED ? {} : { mode: { not: "RECURRING" as const } }),
    },
    include: INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => toEvent(row as EventRow));
}

/** Return a single event by id, or `undefined` when not found. */
export async function getEventById(id: string): Promise<Event | undefined> {
  const row = await db.event.findUnique({ where: { id }, include: INCLUDE });
  return row ? toEvent(row as EventRow) : undefined;
}

/** Return a single event by its custom slug, or `undefined`. */
export async function getEventBySlug(slug: string): Promise<Event | undefined> {
  const row = await db.event.findUnique({ where: { slug }, include: INCLUDE });
  return row ? toEvent(row as EventRow) : undefined;
}

/** Resolve an event by id first, then by custom slug (public routes). */
export async function getEventByIdOrSlug(
  idOrSlug: string,
): Promise<Event | undefined> {
  return (await getEventById(idOrSlug)) ?? (await getEventBySlug(idOrSlug));
}

/**
 * The workspace a new event belongs to.
 *
 * Ownership comes from the session once auth lands. Until then a caller may
 * name a workspace explicitly, and anything else falls back to the first —
 * mirroring what `getWorkspaceByEvent` did for unmapped events before.
 */
async function resolveWorkspaceId(preferred?: string): Promise<string> {
  if (preferred) {
    const found = await db.workspace.findUnique({
      where: { id: preferred },
      select: { id: true },
    });
    if (found) return found.id;
  }
  const first = await db.workspace.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!first) {
    throw new Error("No workspace exists to own the event — seed the database.");
  }
  return first.id;
}

/** Create and persist a new event, returning the stored record. */
export async function createEvent(
  input: CreateEventInput & { workspaceId?: string },
): Promise<Event> {
  const workspaceId = await resolveWorkspaceId(input.workspaceId);

  // The venue is created first: passing a scalar `workspaceId` alongside a
  // nested `venue.create` would put Prisma in its unchecked-input mode, which
  // does not accept nested writes.
  const venue = await db.venue.create({ data: { ...input.venue } });

  const row = await db.event.create({
    data: {
      workspaceId,
      venueId: venue.id,
      title: input.title,
      description: input.description,
      status: EVENT_STATUS_TO_DB[input.status ?? "draft"],
      mode: EVENT_MODE_TO_DB[input.mode],
      recurrence: input.recurrence ? (input.recurrence as object) : undefined,
      tags: input.tags ?? [],
      visibility: EVENT_VISIBILITY_TO_DB[input.visibility ?? "public"],
      audienceTags: input.audienceTags ?? [],
      requiresApproval: input.requiresApproval ?? false,
      sessions: {
        create: input.sessions.map((s) => ({
          startAt: new Date(s.startAt),
          endAt: new Date(s.endAt),
          ...(s.availability
            ? { availability: SESSION_AVAILABILITY_TO_DB[s.availability] }
            : {}),
        })),
      },
    },
    include: INCLUDE,
  });
  return toEvent(row as EventRow);
}

/** Fields an organizer may edit on an existing event. */
export type EventUpdate = Partial<
  Pick<
    Event,
    | "title"
    | "description"
    | "status"
    | "visibility"
    | "audienceTags"
    | "requiresApproval"
    | "slug"
    | "recurrenceSchedule"
  >
>;

/** ScheduleDraft equivalent of a stored {@link RecurrenceSchedule}. */
function toScheduleDraft(spec: RecurrenceSchedule): ScheduleDraft {
  const toSlot = (s: { id: string; startTime: string; endTime: string }) => ({
    id: s.id,
    date: "",
    startTime: s.startTime,
    endTime: s.endTime,
  });
  return {
    calendar: true,
    startDate: spec.startDate,
    endDate: spec.endDate,
    byDay: spec.byDay,
    slots: spec.slots.map(toSlot),
    daySlots: Object.fromEntries(
      Object.entries(spec.daySlots ?? {}).map(([d, arr]) => [
        d,
        (arr ?? []).map(toSlot),
      ]),
    ),
    exceptions: spec.exceptions,
  };
}

/**
 * Regenerate an event's sessions from a calendar schedule.
 *
 * Sessions are matched on start time rather than id — that is what the
 * `@@unique([eventId, startAt])` index exists for — so a surviving سانس keeps
 * its row, and with it its availability, cancelled flag and any references.
 */
async function applySchedule(
  eventId: string,
  spec: RecurrenceSchedule,
): Promise<void> {
  const existing = await db.eventSession.findMany({ where: { eventId } });
  const byStart = new Map(existing.map((s) => [s.startAt.toISOString(), s]));

  const wanted = expandSchedule(toScheduleDraft(spec)).map((s) => ({
    startAt: new Date(`${s.date}T${s.startTime}:00.000Z`),
    endAt: new Date(`${s.date}T${s.endTime || s.startTime}:00.000Z`),
  }));
  const wantedKeys = new Set(wanted.map((s) => s.startAt.toISOString()));

  await db.$transaction([
    // Drop the سانس‌ها the new schedule no longer contains.
    db.eventSession.deleteMany({
      where: {
        eventId,
        id: {
          in: existing
            .filter((s) => !wantedKeys.has(s.startAt.toISOString()))
            .map((s) => s.id),
        },
      },
    }),
    // Add the ones it gained; survivors are left untouched.
    ...wanted
      .filter((s) => !byStart.has(s.startAt.toISOString()))
      .map((s) =>
        db.eventSession.create({
          data: { eventId, startAt: s.startAt, endAt: s.endAt },
        }),
      ),
  ]);
}

/** Apply an update to an event; returns it, or `undefined` if absent. */
export async function updateEvent(
  id: string,
  patch: EventUpdate,
): Promise<Event | undefined> {
  const exists = await db.event.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return undefined;

  if (patch.recurrenceSchedule !== undefined) {
    await applySchedule(id, patch.recurrenceSchedule);
  }

  await db.event.update({
    where: { id },
    data: {
      title: patch.title,
      description: patch.description,
      status: patch.status ? EVENT_STATUS_TO_DB[patch.status] : undefined,
      visibility: patch.visibility
        ? EVENT_VISIBILITY_TO_DB[patch.visibility]
        : undefined,
      audienceTags: patch.audienceTags,
      requiresApproval: patch.requiresApproval,
      slug: patch.slug,
      ...(patch.recurrenceSchedule !== undefined
        ? {
            recurrenceSchedule: patch.recurrenceSchedule as object,
            recurrence: {
              frequency: "weekly",
              interval: 1,
              ...(patch.recurrenceSchedule.byDay.length > 0
                ? { byDay: patch.recurrenceSchedule.byDay }
                : {}),
            } as object,
          }
        : {}),
    },
  });

  return getEventById(id);
}

/** Append a new سانس (session) to an event; returns it, or `undefined`. */
export async function addSession(
  eventId: string,
  input: { startAt: string; endAt: string; availability?: SessionAvailability },
): Promise<EventSession | undefined> {
  const exists = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!exists) return undefined;

  const row = await db.eventSession.create({
    data: {
      eventId,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      ...(input.availability
        ? { availability: SESSION_AVAILABILITY_TO_DB[input.availability] }
        : {}),
    },
  });
  await db.event.update({ where: { id: eventId }, data: { updatedAt: new Date() } });
  return toSession(row);
}

/** Venue fields an organizer may edit from the dashboard. */
export type VenueUpdate = Partial<
  Pick<
    Venue,
    "name" | "province" | "city" | "address" | "capacity" | "lat" | "lng" | "hideAddress"
  >
>;

/** Update an event's venue; returns it, or `undefined` if absent. */
export async function updateVenue(
  eventId: string,
  patch: VenueUpdate,
): Promise<Venue | undefined> {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { venueId: true },
  });
  if (!event) return undefined;

  const row = await db.venue.update({ where: { id: event.venueId }, data: patch });
  await db.event.update({ where: { id: eventId }, data: { updatedAt: new Date() } });
  return toVenue(row);
}

/** Fields an organizer may edit on a single سانس (session). */
export type SessionUpdate = Partial<
  Pick<EventSession, "startAt" | "endAt" | "cancelled" | "availability">
>;

/**
 * Update one session of an event (reschedule or cancel/restore).
 * Returns the session, or `undefined` when the event/session is not found.
 */
export async function updateSession(
  eventId: string,
  sessionId: string,
  patch: SessionUpdate,
): Promise<EventSession | undefined> {
  const session = await db.eventSession.findUnique({ where: { id: sessionId } });
  if (!session || session.eventId !== eventId) return undefined;

  const row = await db.eventSession.update({
    where: { id: sessionId },
    data: {
      startAt: patch.startAt ? new Date(patch.startAt) : undefined,
      endAt: patch.endAt ? new Date(patch.endAt) : undefined,
      cancelled: patch.cancelled,
      availability: patch.availability
        ? SESSION_AVAILABILITY_TO_DB[patch.availability]
        : undefined,
    },
  });
  await db.event.update({ where: { id: eventId }, data: { updatedAt: new Date() } });
  return toSession(row);
}
