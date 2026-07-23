/**
 * Client-side "notify me when tickets go on sale" state, persisted in
 * localStorage. Stands in for a server-side reminder list until auth/persistence
 * lands. Guards `window` so it is safe to import in components rendered on the
 * server.
 */

export const NOTIFY_KEY = "poster-notify";

export function getNotifiedEventIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(NOTIFY_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === "string")
      : [];
  } catch {
    return [];
  }
}

export function isNotified(eventId: string): boolean {
  return getNotifiedEventIds().includes(eventId);
}

export function setNotified(eventId: string, notify: boolean): string[] {
  const set = new Set(getNotifiedEventIds());
  if (notify) set.add(eventId);
  else set.delete(eventId);
  const arr = [...set];
  if (typeof window !== "undefined") {
    localStorage.setItem(NOTIFY_KEY, JSON.stringify(arr));
  }
  return arr;
}
