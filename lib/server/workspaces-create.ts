/**
 * Creating a workspace — the act that turns a normal user into an event
 * manager. Kept apart from the read-side data access because it owns the slug
 * rules.
 */

import { db } from "./db";
import { toWorkspace } from "./mappers";
import { WORKSPACE_TYPE_TO_DB } from "./mappers/enums";
import type { Workspace, WorkspaceType } from "@/types";

/**
 * A URL-safe slug from a workspace name.
 *
 * Persian names transliterate to nothing useful, so when no ASCII survives we
 * fall back to a stable prefix rather than producing an empty slug.
 */
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40)
    .replace(/^-|-$/g, "");
  return base || "workspace";
}

/** The first free slug of the form `base`, `base-2`, `base-3`, … */
async function uniqueSlug(base: string): Promise<string> {
  const taken = await db.workspace.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  const used = new Set(taken.map((w) => w.slug));
  if (!used.has(base)) return base;

  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error(`Could not find a free slug for "${base}".`);
}

/** Initials for the avatar chip — first letters of the first two words. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => [...word][0] ?? "")
    .join("");
}

/** Create a workspace and make `userId` its owner. */
export async function createWorkspace(input: {
  userId: string;
  name: string;
  type: WorkspaceType;
  /** Optional public blurb. The column existed; nothing ever wrote to it. */
  bio?: string;
}): Promise<Workspace> {
  const row = await db.workspace.create({
    data: {
      slug: await uniqueSlug(slugify(input.name)),
      name: input.name,
      type: WORKSPACE_TYPE_TO_DB[input.type],
      ...(input.bio ? { bio: input.bio } : {}),
      avatar: initials(input.name) || "؟",
      members: { create: { userId: input.userId, role: "OWNER" } },
    },
  });
  return toWorkspace(row);
}
