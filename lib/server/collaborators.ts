/**
 * Event collaborator (co-host) data-access over the in-memory
 * {@link eventCollaborators} store.
 */

import type { EventCollaborator, CollaboratorChannel } from "@/types";

import { eventCollaborators } from "./store";

/** Collaborators/requests for an event, newest first. */
export async function listCollaborators(
  eventId: string,
): Promise<EventCollaborator[]> {
  return eventCollaborators
    .filter((c) => c.eventId === eventId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Accepted collaborators only (used on the public event page). */
export async function listAcceptedCollaborators(
  eventId: string,
): Promise<EventCollaborator[]> {
  return (await listCollaborators(eventId)).filter(
    (c) => c.status === "accepted",
  );
}

export interface AddCollaboratorInput {
  channel: CollaboratorChannel;
  label: string;
  sub: string;
  workspaceSlug?: string;
  avatar?: string;
}

/** Add a collaboration request; returns the stored record. */
export async function addCollaborator(
  eventId: string,
  input: AddCollaboratorInput,
): Promise<EventCollaborator> {
  const collaborator: EventCollaborator = {
    id: crypto.randomUUID(),
    eventId,
    channel: input.channel,
    label: input.label,
    sub: input.sub,
    workspaceSlug: input.workspaceSlug,
    avatar: input.avatar,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  eventCollaborators.push(collaborator);
  return collaborator;
}

/** Remove a collaboration request; returns true when one was removed. */
export async function removeCollaborator(id: string): Promise<boolean> {
  const i = eventCollaborators.findIndex((c) => c.id === id);
  if (i < 0) return false;
  eventCollaborators.splice(i, 1);
  return true;
}
