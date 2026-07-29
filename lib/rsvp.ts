/**
 * Event bookmarks («می‌روم» / «علاقه‌مندم»), server-backed.
 *
 * Was a `poster-rsvp` localStorage map. Now a real row, which is what makes
 * the going counts on discovery mean anything.
 */

export type RsvpState = "interested" | "going" | null;

export interface ViewerState {
  bookmark: RsvpState;
  notify: boolean;
}

/**
 * Set the desired state — not a toggle — so a double-tap or a retry converges
 * rather than flip-flopping.
 */
export async function setRsvp(
  eventId: string,
  state: RsvpState,
): Promise<ViewerState | null> {
  const res = await fetch(`/api/events/${eventId}/bookmark`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return "data" in json ? (json.data as ViewerState) : null;
}
