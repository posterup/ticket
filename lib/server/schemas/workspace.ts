import { z } from "zod";

import type { WorkspaceType } from "@/types";
import { nonEmpty } from "./common";

/**
 * `POST /api/workspaces` — create one, and become its owner.
 *
 * Deliberately not `registerSchema`. That one is the sign-up step and demands a
 * `fullName`, because it is also where a brand-new account gets its name. A
 * signed-in person adding a workspace already has one, and asking a form to
 * re-send it invites overwriting a good name with whatever happened to be in
 * scope.
 */
export const createWorkspaceSchema = z.object({
  name: nonEmpty.max(120),
  type: z.enum(["personal", "business"] satisfies readonly WorkspaceType[]),
  /** Optional public blurb; the column has always existed and nothing set it. */
  bio: z.string().trim().max(280).optional(),
});
