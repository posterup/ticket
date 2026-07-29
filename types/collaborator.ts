import type { IsoDateTime } from "./api";

export type CollaboratorChannel = "workspace" | "phone" | "username";

/**
 * What an accepted collaborator may do on the event.
 *
 * - `co-host`: run the event alongside the organizer.
 * - `checkin`: work the door only.
 */
export type EventCollabRole = "co-host" | "checkin";
export type CollaboratorStatus = "pending" | "accepted";

/**
 * Another host or workspace invited to co-manage an event. A request may target
 * an existing workspace (by slug) or a raw username / phone.
 */
export interface EventCollaborator {
  id: string;
  eventId: string;
  channel: CollaboratorChannel;
  /** Display label — workspace name or the raw contact. */
  label: string;
  /** `@slug` for a workspace, or a contact-type hint otherwise. */
  sub: string;
  /** Workspace slug when `channel === "workspace"`. */
  workspaceSlug?: string;
  /** Workspace avatar initials when applicable. */
  avatar?: string;
  status: CollaboratorStatus;
  createdAt: IsoDateTime;
}
