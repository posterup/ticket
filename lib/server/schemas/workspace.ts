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
  /**
   * Optional, defaulting to `business`.
   *
   * The create form no longer asks. The type decides nothing — four surfaces
   * render it as a label «کسب‌وکار»/«شخصی» and none branches on it — so making
   * someone classify themselves before naming the thing was a permanent
   * decision charged for a caption. `business` is what the form preselected
   * and what an organiser page is in the public directory.
   *
   * Still accepted, because a caller that has a real answer should be able to
   * say so: `POST /api/auth/register` sends one, and a workspace settings
   * screen will want to change it.
   */
  type: z
    .enum(["personal", "business"] satisfies readonly WorkspaceType[])
    .default("business"),
  /** Optional public blurb; the column has always existed and nothing set it. */
  bio: z.string().trim().max(280).optional(),
});
