/**
 * Event data-access functions over the in-memory {@link events} store.
 * Replace the array operations with real queries when a datastore is added.
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

import { events } from "./store";

/**
 * Return every event, newest first. While calendar mode is disabled, recurring
 * (تقویمی) events are hidden from every listing so the mode leaves no trace;
 * direct lookups ({@link getEventById}) still resolve them. See {@link CALENDAR_MODE_ENABLED}.
 */
export async function listEvents(): Promise<Event[]> {
  return [...events]
    .filter((event) => CALENDAR_MODE_ENABLED || event.mode !== "recurring")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Return a single event by id, or `undefined` when not found. */
export async function getEventById(id: string): Promise<Event | undefined> {
  return events.find((event) => event.id === id);
}

/** Return a single event by its custom slug, or `undefined`. */
export async function getEventBySlug(slug: string): Promise<Event | undefined> {
  return events.find((event) => event.slug === slug);
}

/** Resolve an event by id first, then by custom slug (public routes). */
export async function getEventByIdOrSlug(
  idOrSlug: string,
): Promise<Event | undefined> {
  return (await getEventById(idOrSlug)) ?? (await getEventBySlug(idOrSlug));
}

/** Create and persist a new event, returning the stored record. */
export async function createEvent(input: CreateEventInput): Promise<Event> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const venue: Venue = { id: crypto.randomUUID(), ...input.venue };

  const sessions: EventSession[] = input.sessions.map((session) => ({
    id: crypto.randomUUID(),
    eventId: id,
    ...session,
  }));

  const event: Event = {
    id,
    title: input.title,
    description: input.description,
    status: input.status ?? "draft",
    mode: input.mode,
    venue,
    sessions,
    recurrence: input.recurrence,
    tags: input.tags ?? [],
    visibility: input.visibility ?? "public",
    audienceTags: input.audienceTags ?? [],
    requiresApproval: input.requiresApproval ?? false,
    createdAt: now,
    updatedAt: now,
  };

  events.push(event);
  return event;
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
 * Regenerate an event's concrete sessions from a calendar schedule, preserving
 * each surviving session's id, availability, and cancelled flag by matching on
 * date + start time so existing references stay intact.
 */
function sessionsFromSchedule(
  event: Event,
  spec: RecurrenceSchedule,
): EventSession[] {
  const prev = new Map(
    event.sessions.map((s) => [`${s.startAt.slice(0, 16)}`, s]),
  );
  return expandSchedule(toScheduleDraft(spec)).map((s) => {
    const startAt = `${s.date}T${s.startTime}:00.000Z`;
    const endAt = `${s.date}T${s.endTime || s.startTime}:00.000Z`;
    const match = prev.get(startAt.slice(0, 16));
    return {
      id: match?.id ?? `${event.id}-${s.date}-${s.id}`,
      eventId: event.id,
      startAt,
      endAt,
      ...(match?.availability ? { availability: match.availability } : {}),
      ...(match?.cancelled ? { cancelled: match.cancelled } : {}),
    };
  });
}

/** Apply an in-place update to an event; returns it, or `undefined` if absent. */
export async function updateEvent(
  id: string,
  patch: EventUpdate,
): Promise<Event | undefined> {
  const event = events.find((e) => e.id === id);
  if (!event) return undefined;
  if (patch.title !== undefined) event.title = patch.title;
  if (patch.description !== undefined) event.description = patch.description;
  if (patch.status !== undefined) event.status = patch.status;
  if (patch.visibility !== undefined) event.visibility = patch.visibility;
  if (patch.audienceTags !== undefined) event.audienceTags = patch.audienceTags;
  if (patch.requiresApproval !== undefined) {
    event.requiresApproval = patch.requiresApproval;
  }
  if (patch.slug !== undefined) event.slug = patch.slug;
  if (patch.recurrenceSchedule !== undefined) {
    event.recurrenceSchedule = patch.recurrenceSchedule;
    event.sessions = sessionsFromSchedule(event, patch.recurrenceSchedule);
    event.recurrence = {
      frequency: "weekly",
      interval: 1,
      ...(patch.recurrenceSchedule.byDay.length > 0
        ? { byDay: patch.recurrenceSchedule.byDay }
        : {}),
    };
  }
  event.updatedAt = new Date().toISOString();
  return event;
}

/** Append a new سانس (session) to an event; returns it, or `undefined`. */
export async function addSession(
  eventId: string,
  input: { startAt: string; endAt: string; availability?: SessionAvailability },
): Promise<EventSession | undefined> {
  const event = events.find((e) => e.id === eventId);
  if (!event) return undefined;
  const session: EventSession = {
    id: crypto.randomUUID(),
    eventId,
    startAt: input.startAt,
    endAt: input.endAt,
    ...(input.availability ? { availability: input.availability } : {}),
  };
  event.sessions.push(session);
  event.updatedAt = new Date().toISOString();
  return session;
}

/** Venue fields an organizer may edit from the dashboard. */
export type VenueUpdate = Partial<
  Pick<
    Venue,
    "name" | "province" | "city" | "address" | "capacity" | "lat" | "lng" | "hideAddress"
  >
>;

/** Update an event's venue in place; returns it, or `undefined` if absent. */
export async function updateVenue(
  eventId: string,
  patch: VenueUpdate,
): Promise<Venue | undefined> {
  const event = events.find((e) => e.id === eventId);
  if (!event) return undefined;
  const v = event.venue;
  if (patch.name !== undefined) v.name = patch.name;
  if (patch.province !== undefined) v.province = patch.province;
  if (patch.city !== undefined) v.city = patch.city;
  if (patch.address !== undefined) v.address = patch.address;
  if (patch.capacity !== undefined) v.capacity = patch.capacity;
  if (patch.lat !== undefined) v.lat = patch.lat;
  if (patch.lng !== undefined) v.lng = patch.lng;
  if (patch.hideAddress !== undefined) v.hideAddress = patch.hideAddress;
  event.updatedAt = new Date().toISOString();
  return v;
}

/** Fields an organizer may edit on a single سانس (session). */
export type SessionUpdate = Partial<
  Pick<EventSession, "startAt" | "endAt" | "cancelled" | "availability">
>;

/**
 * Update one session of an event in place (reschedule or cancel/restore).
 * Returns the session, or `undefined` when the event/session is not found.
 */
export async function updateSession(
  eventId: string,
  sessionId: string,
  patch: SessionUpdate,
): Promise<EventSession | undefined> {
  const event = events.find((e) => e.id === eventId);
  const session = event?.sessions.find((s) => s.id === sessionId);
  if (!event || !session) return undefined;
  if (patch.startAt !== undefined) session.startAt = patch.startAt;
  if (patch.endAt !== undefined) session.endAt = patch.endAt;
  if (patch.cancelled !== undefined) session.cancelled = patch.cancelled;
  if (patch.availability !== undefined) session.availability = patch.availability;
  event.updatedAt = new Date().toISOString();
  return session;
}
