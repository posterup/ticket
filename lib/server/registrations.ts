/**
 * Registration-request data-access over the in-memory {@link eventRegistrations}
 * store. Requests belong to approval-gated events; the organiser accepts or
 * rejects each one.
 */

import type { EventRegistration, RegistrationStatus } from "@/types";

import { eventRegistrations } from "./store";

/** Registration requests for an event, newest first. */
export async function listRegistrations(
  eventId: string,
): Promise<EventRegistration[]> {
  return eventRegistrations
    .filter((r) => r.eventId === eventId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export interface CreateRegistrationInput {
  name: string;
  phone: string;
  tickets: number;
}

/**
 * Record an attendee's request to join an approval-gated event. Always starts
 * `pending` — only the organiser may move it on from there.
 */
export async function createRegistration(
  eventId: string,
  input: CreateRegistrationInput,
): Promise<EventRegistration> {
  const registration: EventRegistration = {
    id: crypto.randomUUID(),
    eventId,
    name: input.name,
    phone: input.phone,
    tickets: input.tickets,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  eventRegistrations.push(registration);
  return registration;
}

/** Accept/reject a request (or reset to pending); returns it, or `undefined`. */
export async function setRegistrationStatus(
  id: string,
  status: RegistrationStatus,
): Promise<EventRegistration | undefined> {
  const registration = eventRegistrations.find((r) => r.id === id);
  if (!registration) return undefined;
  registration.status = status;
  return registration;
}
