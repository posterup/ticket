/**
 * "Tell me when this opens", server-backed.
 *
 * Was a `poster-notify` localStorage set, which meant nobody could actually be
 * told — nothing server-side knew who had asked.
 */

import type { ViewerState } from "./rsvp";

/** Ask, or stop asking, to be notified about an event. Idempotent. */
export async function setNotified(
  eventId: string,
  wanted: boolean,
): Promise<ViewerState | null> {
  const res = await fetch(`/api/events/${eventId}/notify`, {
    method: wanted ? "POST" : "DELETE",
  });
  if (!res.ok) return null;
  const json = await res.json();
  return "data" in json ? (json.data as ViewerState) : null;
}
