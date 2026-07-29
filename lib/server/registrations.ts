/**
 * Registration-request data-access over Postgres. Requests belong to
 * approval-gated events; the organiser accepts or rejects each one.
 */

import type { EventRegistration, RegistrationStatus } from "@/types";

import { db } from "./db";
import { toRegistration } from "./mappers";
import { REGISTRATION_STATUS_TO_DB } from "./mappers/enums";

/** Registration requests for an event, newest first. */
export async function listRegistrations(
  eventId: string,
): Promise<EventRegistration[]> {
  const rows = await db.eventRegistration.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRegistration);
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
  const row = await db.eventRegistration.create({
    data: {
      eventId,
      name: input.name,
      phone: input.phone,
      tickets: input.tickets,
    },
  });
  return toRegistration(row);
}

/** Accept/reject a request (or reset to pending); returns it, or `undefined`. */
export async function setRegistrationStatus(
  id: string,
  status: RegistrationStatus,
): Promise<EventRegistration | undefined> {
  const exists = await db.eventRegistration.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) return undefined;

  const row = await db.eventRegistration.update({
    where: { id },
    data: { status: REGISTRATION_STATUS_TO_DB[status] },
  });
  return toRegistration(row);
}
