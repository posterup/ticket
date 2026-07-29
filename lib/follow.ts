/**
 * Following, server-backed.
 *
 * Was a `poster-following` localStorage set — keyed to nothing but the browser,
 * so it vanished on a new device and could not inform the feed server-side.
 * The initial state now arrives as props from the page that renders the
 * control, which also removes the flash of the wrong label on first paint.
 */

export interface FollowResult {
  following: boolean;
  followers: number;
}

/** Follow or unfollow a page. Idempotent. */
export async function setFollowed(
  slug: string,
  follow: boolean,
): Promise<FollowResult | null> {
  const res = await fetch(`/api/workspaces/${slug}/follow`, {
    method: follow ? "POST" : "DELETE",
  });
  if (!res.ok) return null;
  const json = await res.json();
  return "data" in json ? (json.data as FollowResult) : null;
}
