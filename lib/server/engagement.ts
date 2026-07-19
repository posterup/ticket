/**
 * Per-event engagement counts (going / interested) — the social-proof baseline
 * shown across discovery. Seeded in a module-level map that stands in for
 * aggregated attendance rows until a datastore is added. The signed-in user's
 * own RSVP is layered on top client-side (optimistic), exactly as follower
 * counts work.
 */

export interface EventEngagement {
  going: number;
  interested: number;
}

const ENGAGEMENT: Record<string, EventEngagement> = {
  "3f1a6c2e-0001-4a10-9b21-1a2b3c4d5e01": { going: 842, interested: 1360 },
  "3f1a6c2e-0002-4a10-9b21-1a2b3c4d5e02": { going: 26, interested: 74 },
  "3f1a6c2e-0003-4a10-9b21-1a2b3c4d5e03": { going: 118, interested: 240 },
  "3f1a6c2e-0004-4a10-9b21-1a2b3c4d5e04": { going: 510, interested: 930 },
  "3f1a6c2e-0005-4a10-9b21-1a2b3c4d5e05": { going: 64, interested: 152 },
  "3f1a6c2e-0006-4a10-9b21-1a2b3c4d5e06": { going: 388, interested: 605 },
  "3f1a6c2e-0007-4a10-9b21-1a2b3c4d5e07": { going: 72, interested: 133 },
};

/** Baseline engagement for an event (zeros when unseeded/newly created). */
export function getEventEngagement(eventId: string): EventEngagement {
  return ENGAGEMENT[eventId] ?? { going: 0, interested: 0 };
}
