/**
 * Event guest-list data-access over the in-memory {@link eventGuests} store.
 * Guests are RSVP-only (no payment).
 */

import type { EventGuest, GuestRsvp } from "@/types";

import { eventGuests } from "./store";

/** Guests invited to an event, newest first. */
export function listGuests(eventId: string): EventGuest[] {
  return eventGuests
    .filter((g) => g.eventId === eventId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export interface AddGuestInput {
  contact: string;
  channel: "phone" | "email";
}

/** Add a guest to an event; returns the stored record. */
export function addGuest(eventId: string, input: AddGuestInput): EventGuest {
  const guest: EventGuest = {
    id: crypto.randomUUID(),
    eventId,
    contact: input.contact,
    channel: input.channel,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  eventGuests.push(guest);
  return guest;
}

/** Update a guest's RSVP status; returns it, or `undefined` if absent. */
export function setGuestStatus(
  id: string,
  status: GuestRsvp,
): EventGuest | undefined {
  const guest = eventGuests.find((g) => g.id === id);
  if (!guest) return undefined;
  guest.status = status;
  return guest;
}

/** Remove a guest; returns true when one was removed. */
export function removeGuest(id: string): boolean {
  const i = eventGuests.findIndex((g) => g.id === id);
  if (i < 0) return false;
  eventGuests.splice(i, 1);
  return true;
}
