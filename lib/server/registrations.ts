/**
 * Registration-request data-access over Postgres. Requests belong to
 * approval-gated events; the organiser accepts or rejects each one.
 */

import type { EventRegistration, RegistrationStatus } from "@/types";
import { normalizeMobile } from "@/lib/server/sms";

import { db } from "./db";
import {
  notifyRegistrationDecision,
  notifyRegistrationRequested,
} from "./notifications/waiting";
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
      // Normalised on the way in, like `waitlist.ts` does. Stored raw, the same
      // requester typing `+98…` one day and `09…` the next produced two
      // requests, and the approval gate in `createOrder` matched whichever one
      // the organiser happened to accept.
      phone: normalizeMobile(input.phone),
      tickets: input.tickets,
    },
  });

  // Not awaited: the guest's confirmation should not wait on an SMS operator,
  // and the notifier never throws.
  void notifyRegistrationRequested(row.id);

  return toRegistration(row);
}

/** Accept/reject a request (or reset to pending); returns it, or `undefined`. */
export async function setRegistrationStatus(
  id: string,
  status: RegistrationStatus,
): Promise<EventRegistration | undefined> {
  const exists = await db.eventRegistration.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!exists) return undefined;

  const next = REGISTRATION_STATUS_TO_DB[status];
  // Only a real change notifies. Re-saving an already-accepted request, which
  // a dashboard does on every click, must not text the guest twice.
  const changed = exists.status !== next;

  const row = await db.eventRegistration.update({
    where: { id },
    data: { status: next },
  });

  if (changed) void notifyRegistrationDecision(row.id);

  return toRegistration(row);
}
