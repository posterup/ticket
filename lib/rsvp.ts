/**
 * Client-side RSVP state, persisted in localStorage. The lightweight social
 * commitment ("interested" / "going") that sits alongside ticket purchase.
 * Stands in for a server-side attendance graph until auth/persistence lands.
 * Guards `window` so it is safe to import in server-rendered components.
 */

export const RSVP_KEY = "poster-rsvp";

/** How an attendee has marked an event. */
export type RsvpState = "interested" | "going";

export type RsvpMap = Record<string, RsvpState>;

function isRsvpState(v: unknown): v is RsvpState {
  return v === "interested" || v === "going";
}

/** Read the full { eventId -> state } map from storage. */
export function getRsvps(): RsvpMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(RSVP_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: RsvpMap = {};
    for (const [id, state] of Object.entries(parsed)) {
      if (isRsvpState(state)) out[id] = state;
    }
    return out;
  } catch {
    return {};
  }
}

/** The current RSVP state for one event, or `null` when unset. */
export function getRsvp(eventId: string): RsvpState | null {
  return getRsvps()[eventId] ?? null;
}

/** Set (or clear, with `null`) the RSVP state for an event; returns the map. */
export function setRsvp(eventId: string, state: RsvpState | null): RsvpMap {
  const map = getRsvps();
  if (state === null) delete map[eventId];
  else map[eventId] = state;
  if (typeof window !== "undefined") {
    localStorage.setItem(RSVP_KEY, JSON.stringify(map));
  }
  return map;
}

/** Event ids marked with a given state (or any state when omitted). */
export function getRsvpEventIds(state?: RsvpState): string[] {
  const map = getRsvps();
  return Object.keys(map).filter((id) => (state ? map[id] === state : true));
}
