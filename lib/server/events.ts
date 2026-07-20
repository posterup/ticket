/**
 * Event data-access functions over the in-memory {@link events} store.
 * Replace the array operations with real queries when a datastore is added.
 */

import type { CreateEventInput, Event, EventSession, Venue } from "@/types";

import { events } from "./store";

/** Return every event, newest first. */
export function listEvents(): Event[] {
  return [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Return a single event by id, or `undefined` when not found. */
export function getEventById(id: string): Event | undefined {
  return events.find((event) => event.id === id);
}

/** Create and persist a new event, returning the stored record. */
export function createEvent(input: CreateEventInput): Event {
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
    createdAt: now,
    updatedAt: now,
  };

  events.push(event);
  return event;
}

/** Fields an organizer may edit on an existing event. */
export type EventUpdate = Partial<
  Pick<Event, "title" | "description" | "status">
>;

/** Apply an in-place update to an event; returns it, or `undefined` if absent. */
export function updateEvent(id: string, patch: EventUpdate): Event | undefined {
  const event = events.find((e) => e.id === id);
  if (!event) return undefined;
  if (patch.title !== undefined) event.title = patch.title;
  if (patch.description !== undefined) event.description = patch.description;
  if (patch.status !== undefined) event.status = patch.status;
  event.updatedAt = new Date().toISOString();
  return event;
}

/** Fields an organizer may edit on a single سانس (session). */
export type SessionUpdate = Partial<
  Pick<EventSession, "startAt" | "endAt" | "cancelled">
>;

/**
 * Update one session of an event in place (reschedule or cancel/restore).
 * Returns the session, or `undefined` when the event/session is not found.
 */
export function updateSession(
  eventId: string,
  sessionId: string,
  patch: SessionUpdate,
): EventSession | undefined {
  const event = events.find((e) => e.id === eventId);
  const session = event?.sessions.find((s) => s.id === sessionId);
  if (!event || !session) return undefined;
  if (patch.startAt !== undefined) session.startAt = patch.startAt;
  if (patch.endAt !== undefined) session.endAt = patch.endAt;
  if (patch.cancelled !== undefined) session.cancelled = patch.cancelled;
  event.updatedAt = new Date().toISOString();
  return session;
}
