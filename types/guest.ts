import type { IsoDateTime } from "./api";

/** RSVP state of an invited guest. */
export type GuestRsvp = "pending" | "going" | "declined";

/**
 * A guest invited to a specific session of an event by phone or username.
 * Guests don't pay — they only RSVP (coming or not).
 */
export interface EventGuest {
  id: string;
  eventId: string;
  /** The سانس (session) the guest is invited to. */
  sessionId: string;
  contact: string;
  channel: "phone" | "username";
  status: GuestRsvp;
  createdAt: IsoDateTime;
}
