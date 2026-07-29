/**
 * A signed-in visitor's own engagement: which pages they follow, which events
 * they have marked, and which they want to be told about.
 *
 * These replace the `poster-following`, `poster-rsvp` and `poster-notify`
 * localStorage stores, which were keyed to nothing but the browser — so they
 * vanished on a new device and could not inform anything server-side.
 */

import type { Event } from "@/types";

import { db } from "./db";
import { toEvent, toWorkspace, type EventRow } from "./mappers";
import type { Workspace } from "@/types";

const EVENT_INCLUDE = {
  venue: true,
  sessions: { orderBy: { startAt: "asc" } },
} as const;

/** What a viewer has done to one event, for rendering its controls. */
export interface EventViewerState {
  bookmark: "interested" | "going" | null;
  notify: boolean;
}

// ── follows ───────────────────────────────────────────────────────────

/** Follow or unfollow a workspace. Returns the resulting state and count. */
export async function setFollowing(
  userId: string,
  slug: string,
  following: boolean,
): Promise<{ following: boolean; followers: number } | undefined> {
  const workspace = await db.workspace.findUnique({
    where: { slug },
    select: { id: true, seedFollowers: true },
  });
  if (!workspace) return undefined;

  if (following) {
    await db.follow.upsert({
      where: { userId_workspaceId: { userId, workspaceId: workspace.id } },
      create: { userId, workspaceId: workspace.id },
      update: {},
    });
  } else {
    await db.follow.deleteMany({ where: { userId, workspaceId: workspace.id } });
  }

  const live = await db.follow.count({ where: { workspaceId: workspace.id } });
  // Seeded baseline plus real rows, so the number does not visibly deflate.
  return { following, followers: workspace.seedFollowers + live };
}

export async function listFollowedSlugs(userId: string): Promise<string[]> {
  const rows = await db.follow.findMany({
    where: { userId },
    select: { workspace: { select: { slug: true } } },
  });
  return rows.map((r) => r.workspace.slug);
}

export async function listFollowedWorkspaces(
  userId: string,
): Promise<Workspace[]> {
  const rows = await db.workspace.findMany({
    where: { followers: { some: { userId } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toWorkspace);
}

// ── bookmarks ─────────────────────────────────────────────────────────

/**
 * Mark an event as going/interested, or clear it with `null`. Idempotent, so
 * the client can send the state it wants rather than a toggle.
 */
export async function setBookmark(
  userId: string,
  eventId: string,
  state: "interested" | "going" | null,
): Promise<boolean> {
  const exists = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!exists) return false;

  if (state === null) {
    await db.bookmark.deleteMany({ where: { userId, eventId } });
    return true;
  }

  const value = state === "going" ? "GOING" : "INTERESTED";
  await db.bookmark.upsert({
    where: { userId_eventId: { userId, eventId } },
    create: { userId, eventId, state: value },
    update: { state: value },
  });
  return true;
}

export async function listBookmarkedEvents(
  userId: string,
): Promise<{ event: Event; state: "interested" | "going" }[]> {
  const rows = await db.bookmark.findMany({
    where: { userId },
    include: { event: { include: EVENT_INCLUDE } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    event: toEvent(row.event as EventRow),
    state: row.state === "GOING" ? "going" : "interested",
  }));
}

// ── notify ────────────────────────────────────────────────────────────

/** Ask, or stop asking, to be told when an event opens or frees up. */
export async function setNotify(
  userId: string,
  eventId: string,
  wanted: boolean,
): Promise<boolean> {
  const exists = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!exists) return false;

  if (wanted) {
    await db.notifySubscription.upsert({
      where: { userId_eventId: { userId, eventId } },
      create: { userId, eventId },
      update: {},
    });
  } else {
    await db.notifySubscription.deleteMany({ where: { userId, eventId } });
  }
  return true;
}

export async function listNotifiedEventIds(userId: string): Promise<string[]> {
  const rows = await db.notifySubscription.findMany({
    where: { userId },
    select: { eventId: true },
  });
  return rows.map((r) => r.eventId);
}

// ── per-event viewer state ────────────────────────────────────────────

/** Everything a viewer has done to one event, in one round trip. */
export async function getViewerState(
  userId: string,
  eventId: string,
): Promise<EventViewerState> {
  const [bookmark, notify] = await Promise.all([
    db.bookmark.findUnique({
      where: { userId_eventId: { userId, eventId } },
      select: { state: true },
    }),
    db.notifySubscription.findUnique({
      where: { userId_eventId: { userId, eventId } },
      select: { userId: true },
    }),
  ]);
  return {
    bookmark: bookmark ? (bookmark.state === "GOING" ? "going" : "interested") : null,
    notify: notify !== null,
  };
}

/**
 * Events from the workspaces a user follows — their feed.
 *
 * Scoped in the query rather than by shipping every event to the browser and
 * filtering there, which is what the localStorage version did.
 */
export async function listFeedEvents(userId: string): Promise<Event[]> {
  const rows = await db.event.findMany({
    where: {
      status: "PUBLISHED",
      workspace: { followers: { some: { userId } } },
    },
    include: EVENT_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => toEvent(row as EventRow));
}
