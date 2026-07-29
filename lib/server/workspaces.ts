/**
 * Workspace data-access over Postgres.
 *
 * Event ownership is now a real `Event.workspaceId` foreign key, replacing the
 * hand-maintained slug→event-ids map this module used to carry.
 */

import type { Event, Workspace } from "@/types";
import { CALENDAR_MODE_ENABLED } from "@/lib/flags";

import { db } from "./db";
import { HttpError } from "./http";
import { toEvent, toWorkspace, type EventRow } from "./mappers";

const EVENT_INCLUDE = {
  venue: true,
  sessions: { orderBy: { startAt: "asc" } },
} as const;

/** Recurring events stay hidden from listings while calendar mode is off. */
const listingFilter = CALENDAR_MODE_ENABLED
  ? {}
  : { mode: { not: "RECURRING" as const } };

export async function listWorkspaces(): Promise<Workspace[]> {
  const rows = await db.workspace.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map(toWorkspace);
}

/**
 * The workspaces a user belongs to.
 *
 * What the switcher offers. `listWorkspaces()` returns every workspace on the
 * platform, which in a switcher means offering to "switch" to someone else's.
 */
export async function listWorkspacesForUser(
  userId: string,
): Promise<Workspace[]> {
  const rows = await db.workspace.findMany({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toWorkspace);
}

export async function getWorkspaceBySlug(
  slug: string,
): Promise<Workspace | undefined> {
  const row = await db.workspace.findUnique({ where: { slug } });
  return row ? toWorkspace(row) : undefined;
}

/** Events owned by a workspace (by slug). */
export async function listEventsByWorkspace(slug: string): Promise<Event[]> {
  const rows = await db.event.findMany({
    where: { workspace: { slug }, ...listingFilter },
    include: EVENT_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => toEvent(row as EventRow));
}

/**
 * Events for many workspaces at once, keyed by slug. Batched so directory
 * pages avoid one query per workspace inside a `.map()`.
 */
export async function listEventsByWorkspaces(
  slugs: string[],
): Promise<Map<string, Event[]>> {
  const out = new Map<string, Event[]>(slugs.map((slug) => [slug, []]));
  if (slugs.length === 0) return out;

  const rows = await db.event.findMany({
    where: { workspace: { slug: { in: slugs } }, ...listingFilter },
    include: { ...EVENT_INCLUDE, workspace: { select: { slug: true } } },
    orderBy: { createdAt: "desc" },
  });
  for (const row of rows) {
    out.get(row.workspace.slug)?.push(toEvent(row as EventRow));
  }
  return out;
}

/** The workspace that owns a given event. */
export async function getWorkspaceByEvent(
  eventId: string,
): Promise<Workspace | undefined> {
  const row = await db.event.findUnique({
    where: { id: eventId },
    select: { workspace: true },
  });
  return row ? toWorkspace(row.workspace) : undefined;
}

/**
 * Owning workspace for many events at once, keyed by event id. Batched so
 * listing pages resolve organisers in one query.
 */
export async function getWorkspacesByEvents(
  eventIds: string[],
): Promise<Map<string, Workspace>> {
  const out = new Map<string, Workspace>();
  if (eventIds.length === 0) return out;

  const rows = await db.event.findMany({
    where: { id: { in: eventIds } },
    select: { id: true, workspace: true },
  });
  for (const row of rows) {
    out.set(row.id, toWorkspace(row.workspace));
  }
  return out;
}

/**
 * Resolve a slug to its workspace id, for routes keyed by slug.
 *
 * Throws rather than returning undefined, because every caller wants the same
 * 404 and would otherwise repeat it.
 */
export async function workspaceIdBySlug(slug: string): Promise<string> {
  const row = await db.workspace.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!row) throw new HttpError(404, "NOT_FOUND", "فضای کاری یافت نشد.");
  return row.id;
}
