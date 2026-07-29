/**
 * Per-event engagement counts (going / interested) — the social-proof numbers
 * shown across discovery.
 *
 * Each event carries a seeded baseline so the figures do not visibly deflate
 * now that they are real; live `Bookmark` rows are added on top as attendees
 * mark events.
 */

import { db } from "./db";

export interface EventEngagement {
  going: number;
  interested: number;
}

const ZERO: EventEngagement = { going: 0, interested: 0 };

/** Engagement for an event (zeros when it does not exist). */
export async function getEventEngagement(
  eventId: string,
): Promise<EventEngagement> {
  return (await getEventEngagements([eventId])).get(eventId) ?? ZERO;
}

/**
 * Engagement for many events at once, keyed by event id. Batched so listing
 * pages avoid a query per row inside a `.map()`.
 */
export async function getEventEngagements(
  eventIds: string[],
): Promise<Map<string, EventEngagement>> {
  const out = new Map<string, EventEngagement>();
  if (eventIds.length === 0) return out;

  const [events, bookmarks] = await Promise.all([
    db.event.findMany({
      where: { id: { in: eventIds } },
      select: { id: true, seedGoing: true, seedInterested: true },
    }),
    db.bookmark.groupBy({
      by: ["eventId", "state"],
      where: { eventId: { in: eventIds } },
      _count: { _all: true },
    }),
  ]);

  for (const e of events) {
    out.set(e.id, { going: e.seedGoing, interested: e.seedInterested });
  }
  for (const b of bookmarks) {
    const current = out.get(b.eventId);
    if (!current) continue;
    if (b.state === "GOING") current.going += b._count._all;
    else current.interested += b._count._all;
  }
  return out;
}
