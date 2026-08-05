"use client";

/**
 * Where the reader was when the server gave up.
 *
 * Sending someone to `/internal-server-error` costs them their place: the URL
 * is gone from the address bar, and «تلاش دوباره» has nothing to try again.
 * Stashing the path first turns the redirect from a dead end into a detour.
 *
 * In `sessionStorage`, deliberately **not** a query parameter. The path is
 * sometimes a secret: `/orders/XJL6HRXX` is a bearer link that admits the
 * holder to someone's tickets, and a query string is written to browser
 * history, to any `Referer` the next request sends, and to every access log in
 * between. Session-scoped storage is read by this tab and nothing else.
 */

const ORIGIN_KEY = "poster:error-origin";

export const INTERNAL_ERROR_PATH = "/internal-server-error";

/** Remember the current location, then hand the reader to the error screen. */
export function bounceToInternalError(): void {
  if (typeof window === "undefined") return;
  // Already there: a second bounce would overwrite the origin with the error
  // page itself, and «تلاش دوباره» would reload the apology.
  if (window.location.pathname === INTERNAL_ERROR_PATH) return;

  try {
    sessionStorage.setItem(
      ORIGIN_KEY,
      window.location.pathname + window.location.search,
    );
  } catch {
    // Private mode, or storage disabled. The screen still renders; it just
    // offers «دیدن رویدادها» instead of a way back to a specific page.
  }

  // `replace`, not `assign`: the broken page should not sit in history where
  // Back returns to it and fails again.
  window.location.replace(INTERNAL_ERROR_PATH);
}

/** The remembered path, or `undefined`. Reading it clears it. */
export function takeErrorOrigin(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const path = sessionStorage.getItem(ORIGIN_KEY);
    // Consumed on read: if the retry also fails the reader is bounced again
    // with a freshly written origin, and a stale one can never outlive the
    // failure that produced it.
    sessionStorage.removeItem(ORIGIN_KEY);
    // Same-document paths only. Anything that could be read as an absolute or
    // protocol-relative URL is refused, so this cannot become an open redirect.
    return path && path.startsWith("/") && !path.startsWith("//")
      ? path
      : undefined;
  } catch {
    return undefined;
  }
}
