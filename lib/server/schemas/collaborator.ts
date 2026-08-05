/** Request schemas for the event-collaborator endpoints. */

import { z } from "zod";

import type { CollaboratorChannel, EventCollabRole } from "@/types";

import { nonEmpty } from "./common";

/** `POST /api/events/:id/collaborators` */
export const addCollaboratorSchema = z.object({
  /** Defaults to co-host; `checkin` grants the door and nothing else. */
  role: z.enum(["co-host", "checkin"] satisfies readonly EventCollabRole[]).optional(),
  channel: z.enum([
    "workspace",
    "phone",
    "username",
  ] satisfies readonly CollaboratorChannel[]),
  label: nonEmpty,
  /** Display hint (`@slug` for a workspace). Defaults to empty. */
  sub: z.string().catch(""),
  workspaceSlug: z.string().optional(),
  // No `avatar`: it is now an image URL that other people's browsers load, and
  // the server can read the real one off the invitee workspace it resolves.
});

/**
 * `PATCH /api/events/:id/collaborators/:collabId`
 *
 * The action, not the target: who may do what is decided from the session.
 */
export const respondInviteSchema = z.object({
  action: z.enum(["accept", "decline", "revoke"]),
});
