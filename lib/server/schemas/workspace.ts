import { z } from "zod";

import { atLeastOneField, nonEmpty, storedImage } from "./common";

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
  /** Optional public blurb; the column has always existed and nothing set it. */
  bio: z.string().trim().max(280).optional(),
});

/**
 * `PATCH /api/workspaces/:slug` — the public profile.
 *
 * `slug` is deliberately absent: it is random and permanent, because it is the
 * address of every organiser page and every link an attendee was ever sent.
 *
 * `avatar` and `banner` are nullable so «حذف تصویر» is expressible — an absent
 * key means "leave it alone" and `null` means "remove it", which a plain
 * optional string cannot tell apart.
 */
export const updateWorkspaceSchema = atLeastOneField(
  z.object({
    name: nonEmpty.max(120).optional(),
    bio: z.string().trim().max(280).nullable().optional(),
    avatar: storedImage.nullable().optional(),
    banner: storedImage.nullable().optional(),
  }),
);
