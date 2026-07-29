/**
 * Event guest-list data-access over Postgres. Guests are RSVP-only (no
 * payment).
 */

import type { EventGuest, GuestRsvp } from "@/types";

import { db } from "./db";
import { toGuest } from "./mappers";
import { GUEST_RSVP_TO_DB } from "./mappers/enums";

/** Guests invited to an event, newest first. */
export async function listGuests(eventId: string): Promise<EventGuest[]> {
  const rows = await db.eventGuest.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toGuest);
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
  const row = await db.eventGuest.create({
    data: {
      eventId,
      sessionId: input.sessionId,
      contact: input.contact,
      channel: input.channel === "username" ? "USERNAME" : "PHONE",
    },
  });
  return toGuest(row);
}

/** Update a guest's RSVP status; returns it, or `undefined` if absent. */
export async function setGuestStatus(
  id: string,
  status: GuestRsvp,
): Promise<EventGuest | undefined> {
  const exists = await db.eventGuest.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) return undefined;

  const row = await db.eventGuest.update({
    where: { id },
    data: { status: GUEST_RSVP_TO_DB[status] },
  });
  return toGuest(row);
}

/** Remove a guest; returns true when one was removed. */
export async function removeGuest(id: string): Promise<boolean> {
  const { count } = await db.eventGuest.deleteMany({ where: { id } });
  return count > 0;
}
