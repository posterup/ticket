/**
 * Registration-request data-access over the in-memory {@link eventRegistrations}
 * store. Requests belong to approval-gated events; the organiser accepts or
 * rejects each one.
 */

import type { EventRegistration, RegistrationStatus } from "@/types";

import { eventRegistrations } from "./store";

/** Registration requests for an event, newest first. */
export function listRegistrations(eventId: string): EventRegistration[] {
  return eventRegistrations
    .filter((r) => r.eventId === eventId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Accept/reject a request (or reset to pending); returns it, or `undefined`. */
export function setRegistrationStatus(
  id: string,
  status: RegistrationStatus,
): EventRegistration | undefined {
  const registration = eventRegistrations.find((r) => r.id === id);
  if (!registration) return undefined;
  registration.status = status;
  return registration;
}
