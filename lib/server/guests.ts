/**
 * Event guest-list data-access over the in-memory {@link eventGuests} store.
 * Guests are RSVP-only (no payment).
 */

import type { EventGuest, GuestRsvp } from "@/types";

import { eventGuests } from "./store";

/** Guests invited to an event, newest first. */
export async function listGuests(eventId: string): Promise<EventGuest[]> {
  return eventGuests
    .filter((g) => g.eventId === eventId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export interface AddGuestInput {
  sessionId: string;
  contact: string;
  channel: "phone" | "username";
}

/** Add a guest to a session of an event; returns the stored record. */
export async function addGuest(
  eventId: string,
  input: AddGuestInput,
): Promise<EventGuest> {
  const guest: EventGuest = {
    id: crypto.randomUUID(),
    eventId,
    sessionId: input.sessionId,
    contact: input.contact,
    channel: input.channel,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  eventGuests.push(guest);
  return guest;
}

/** Update a guest's RSVP status; returns it, or `undefined` if absent. */
export async function setGuestStatus(
  id: string,
  status: GuestRsvp,
): Promise<EventGuest | undefined> {
  const guest = eventGuests.find((g) => g.id === id);
  if (!guest) return undefined;
  guest.status = status;
  return guest;
}

/** Remove a guest; returns true when one was removed. */
export async function removeGuest(id: string): Promise<boolean> {
  const i = eventGuests.findIndex((g) => g.id === id);
  if (i < 0) return false;
  eventGuests.splice(i, 1);
  return true;
}
