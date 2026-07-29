/** Event collaborator (co-host) data-access over Postgres. */

import type { CollaboratorChannel, EventCollaborator } from "@/types";

import { db } from "./db";
import { toCollaborator } from "./mappers";
import { COLLABORATOR_CHANNEL_TO_DB } from "./mappers/enums";

/** Collaborators/requests for an event, newest first. */
export async function listCollaborators(
  eventId: string,
): Promise<EventCollaborator[]> {
  const rows = await db.eventCollaborator.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toCollaborator);
}

/** Accepted collaborators only (used on the public event page). */
export async function listAcceptedCollaborators(
  eventId: string,
): Promise<EventCollaborator[]> {
  const rows = await db.eventCollaborator.findMany({
    where: { eventId, status: "ACCEPTED" },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toCollaborator);
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
  // Resolve the invitee now when it names a workspace, so accepting it later
  // is a status change rather than a lookup that might no longer match.
  const invitee = input.workspaceSlug
    ? await db.workspace.findUnique({
        where: { slug: input.workspaceSlug },
        select: { id: true },
      })
    : null;

  const row = await db.eventCollaborator.create({
    data: {
      eventId,
      channel: COLLABORATOR_CHANNEL_TO_DB[input.channel],
      label: input.label,
      sub: input.sub,
      workspaceSlug: input.workspaceSlug,
      avatar: input.avatar,
      inviteeWorkspaceId: invitee?.id,
    },
  });
  return toCollaborator(row);
}

/** Remove a collaboration request; returns true when one was removed. */
export async function removeCollaborator(id: string): Promise<boolean> {
  const { count } = await db.eventCollaborator.deleteMany({ where: { id } });
  return count > 0;
}
