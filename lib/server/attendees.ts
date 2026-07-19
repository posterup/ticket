/**
 * Attendee (CRM contact) data-access over the in-memory {@link attendees}
 * store. Swap the array operations for real queries when a datastore is added.
 */

import type { Attendee } from "@/types";

import { attendees } from "./store";

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
