/** Request schemas for the event-collaborator endpoints. */

import { z } from "zod";

import type { CollaboratorChannel } from "@/types";

import { nonEmpty } from "./common";

/** `POST /api/events/:id/collaborators` */
export const addCollaboratorSchema = z.object({
  channel: z.enum([
    "workspace",
    "phone",
    "username",
  ] satisfies readonly CollaboratorChannel[]),
  label: nonEmpty,
  /** Display hint (`@slug` for a workspace). Defaults to empty. */
  sub: z.string().catch(""),
  workspaceSlug: z.string().optional(),
  avatar: z.string().optional(),
});
