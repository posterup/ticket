/**
 * Attendee (CRM contact) data-access over the in-memory {@link attendees}
 * store. Swap the array operations for real queries when a datastore is added.
 */

import type { Attendee, Event } from "@/types";

import { attendees } from "./store";
import { listEvents } from "./events";

/** Return all CRM contacts, newest first. */
export function listAttendees(): Attendee[] {
  return [...attendees].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
  );
}

/** Look up a single contact by id. */
export function getAttendeeById(id: string): Attendee | undefined {
  return attendees.find((a) => a.id === id);
}

/** Replace a contact's tags (from string labels); returns it, or `undefined`. */
export function setAttendeeTags(
  id: string,
  labels: string[],
): Attendee | undefined {
  const attendee = attendees.find((a) => a.id === id);
  if (!attendee) return undefined;
  attendee.tags = labels.map((label, i) => ({ id: `t-${i}-${label}`, label }));
  return attendee;
}

/**
 * Mock mapping of which events a contact has joined. Real issued-ticket
 * records don't exist yet; this keeps the CRM contact view populated until
 * a purchases/tickets join lands.
 */
const ATTENDEE_EVENTS: Record<string, string[]> = {
  "e1000000-0000-4000-8000-000000000001": [
    "3f1a6c2e-0001-4a10-9b21-1a2b3c4d5e01",
    "3f1a6c2e-0003-4a10-9b21-1a2b3c4d5e03",
    "3f1a6c2e-0005-4a10-9b21-1a2b3c4d5e05",
  ],
  "e1000000-0000-4000-8000-000000000002": [
    "3f1a6c2e-0002-4a10-9b21-1a2b3c4d5e02",
    "3f1a6c2e-0007-4a10-9b21-1a2b3c4d5e07",
  ],
  "e1000000-0000-4000-8000-000000000003": [
    "3f1a6c2e-0001-4a10-9b21-1a2b3c4d5e01",
    "3f1a6c2e-0003-4a10-9b21-1a2b3c4d5e03",
    "3f1a6c2e-0004-4a10-9b21-1a2b3c4d5e04",
    "3f1a6c2e-0006-4a10-9b21-1a2b3c4d5e06",
  ],
};

/** Events a contact has joined (mock; see {@link ATTENDEE_EVENTS}). */
export function listEventsByAttendee(id: string): Event[] {
  const ids = new Set(ATTENDEE_EVENTS[id] ?? []);
  return listEvents().filter((e) => ids.has(e.id));
}
