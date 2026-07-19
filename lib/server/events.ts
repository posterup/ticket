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
