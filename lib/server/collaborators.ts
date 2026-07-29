/** Event collaborator (co-host) data-access over Postgres. */

import type {
  CollaboratorChannel,
  EventCollabRole,
  EventCollaborator,
} from "@/types";

import { db } from "./db";
import { toCollaborator } from "./mappers";
import { COLLABORATOR_CHANNEL_TO_DB, COLLAB_ROLE_TO_DB } from "./mappers/enums";
import { normalizeMobile } from "./sms/smsir";

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
  /** Defaults to co-host; `checkin` grants the door and nothing else. */
  role?: EventCollabRole;
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
      role: COLLAB_ROLE_TO_DB[input.role ?? "co-host"],
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

export type RespondOutcome =
  | { ok: true; collaborator: EventCollaborator }
  | { ok: false; reason: "not-found" | "not-yours" | "settled"; message: string };

/**
 * Accept or decline an invite, as the person it was sent to.
 *
 * Resolving the invitee is the point of this call. Until it happens the row is
 * only a display record — authorization consults nothing but accepted rows with
 * a resolved invitee, so an invite sent to a phone number grants nothing until
 * the person holding it says yes.
 */
export async function respondToInvite(
  collabId: string,
  actor: { userId: string; workspaceIds: string[]; phone: string },
  accept: boolean,
): Promise<RespondOutcome> {
  const row = await db.eventCollaborator.findUnique({ where: { id: collabId } });
  if (!row) {
    return { ok: false, reason: "not-found", message: "دعوت یافت نشد." };
  }
  if (row.status !== "PENDING") {
    return {
      ok: false,
      reason: "settled",
      message: "این دعوت قبلاً پاسخ داده شده است.",
    };
  }

  // Who the invite is actually for: a workspace the actor belongs to, or —
  // for a raw phone invite — their own number.
  const forMyWorkspace =
    row.inviteeWorkspaceId !== null &&
    actor.workspaceIds.includes(row.inviteeWorkspaceId);
  const forMyPhone =
    row.channel === "PHONE" && normalizeMobile(row.sub || row.label) === actor.phone;

  if (!forMyWorkspace && !forMyPhone) {
    return {
      ok: false,
      reason: "not-yours",
      message: "این دعوت برای شما نیست.",
    };
  }

  const updated = await db.eventCollaborator.update({
    where: { id: collabId },
    data: accept
      ? {
          status: "ACCEPTED",
          acceptedAt: new Date(),
          // Recorded now, so authorization has something concrete to match.
          inviteeUserId: actor.userId,
        }
      : { status: "REVOKED" },
  });
  return { ok: true, collaborator: toCollaborator(updated) };
}

/** Withdraw an accepted collaborator's access, keeping the record. */
export async function revokeCollaborator(
  id: string,
): Promise<EventCollaborator | undefined> {
  const exists = await db.eventCollaborator.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) return undefined;

  const row = await db.eventCollaborator.update({
    where: { id },
    data: { status: "REVOKED" },
  });
  return toCollaborator(row);
}

/** Invites awaiting this actor's answer. */
export async function listPendingInvites(actor: {
  workspaceIds: string[];
  phone: string;
}): Promise<EventCollaborator[]> {
  const rows = await db.eventCollaborator.findMany({
    where: {
      status: "PENDING",
      OR: [
        { inviteeWorkspaceId: { in: actor.workspaceIds } },
        { channel: "PHONE", sub: actor.phone },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toCollaborator);
}
