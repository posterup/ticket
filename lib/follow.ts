/**
 * Client-side follow state, persisted in localStorage. Stands in for a
 * server-side follow graph until auth/persistence lands. Guards `window` so it
 * is safe to import in components rendered on the server.
 */

export const FOLLOW_KEY = "poster-following";

export function getFollowedSlugs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FOLLOW_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export function isFollowed(slug: string): boolean {
  return getFollowedSlugs().includes(slug);
}

export function setFollowed(slug: string, follow: boolean): string[] {
  const set = new Set(getFollowedSlugs());
  if (follow) set.add(slug);
  else set.delete(slug);
  const arr = [...set];
  if (typeof window !== "undefined") {
    localStorage.setItem(FOLLOW_KEY, JSON.stringify(arr));
  }
  return arr;
}
