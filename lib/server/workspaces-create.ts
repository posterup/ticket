/**
 * Creating a workspace — the act that turns a normal user into an event
 * manager. Kept apart from the read-side data access because it owns the slug
 * rules.
 */

import { randomBytes } from "node:crypto";

import { db } from "./db";
import { toWorkspace } from "./mappers";
import type { Workspace } from "@/types";

/**
 * A random URL-safe slug.
 *
 * Deriving it from the name did not work here: Persian transliterates to
 * nothing ASCII, so every Persian-named workspace collapsed to `workspace`,
 * `workspace-2`, `workspace-3` — a counter published in the URL of every
 * organiser page, telling anyone who looked how many workspaces exist.
 *
 * Twelve base32 characters is ~60 bits, so a collision is not something to
 * plan a retry loop around; the unique index on `slug` is the backstop.
 */
export function randomSlug(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789"; // no l/o/0/1
  return [...randomBytes(12)]
    .map((b) => alphabet[b % alphabet.length])
    .join("");
}

/** Create a workspace and make `userId` its owner. */
export async function createWorkspace(input: {
  userId: string;
  name: string;
  /** Optional public blurb. The column existed; nothing ever wrote to it. */
  bio?: string;
}): Promise<Workspace> {
  const row = await db.workspace.create({
    data: {
      slug: randomSlug(),
      name: input.name,
      ...(input.bio ? { bio: input.bio } : {}),
      members: { create: { userId: input.userId, role: "OWNER" } },
    },
  });
  return toWorkspace(row);
}
