import type { IsoDateTime } from "./api";

/** RSVP state of an invited guest. */
export type GuestRsvp = "pending" | "going" | "declined";

/**
 * A guest invited to an event by phone or email. Guests don't pay — they only
 * RSVP (coming or not) and appear in the event's guest list.
 */
export interface EventGuest {
  id: string;
  eventId: string;
  contact: string;
  channel: "phone" | "email";
  status: GuestRsvp;
  createdAt: IsoDateTime;
}
