/**
 * Event collaborator (co-host) data-access over the in-memory
 * {@link eventCollaborators} store.
 */

import type { EventCollaborator, CollaboratorChannel } from "@/types";

import { eventCollaborators } from "./store";

/** Collaborators/requests for an event, newest first. */
export function listCollaborators(eventId: string): EventCollaborator[] {
  return eventCollaborators
    .filter((c) => c.eventId === eventId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Accepted collaborators only (used on the public event page). */
export function listAcceptedCollaborators(eventId: string): EventCollaborator[] {
  return listCollaborators(eventId).filter((c) => c.status === "accepted");
}

export interface AddCollaboratorInput {
  channel: CollaboratorChannel;
  label: string;
  sub: string;
  workspaceSlug?: string;
  avatar?: string;
}

/** Add a collaboration request; returns the stored record. */
export function addCollaborator(
  eventId: string,
  input: AddCollaboratorInput,
): EventCollaborator {
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
export function removeCollaborator(id: string): boolean {
  const i = eventCollaborators.findIndex((c) => c.id === id);
  if (i < 0) return false;
  eventCollaborators.splice(i, 1);
  return true;
}
