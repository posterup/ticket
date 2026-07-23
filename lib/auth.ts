/**
 * Mock, cookie-backed "logged in" flag.
 *
 * There is no real auth yet (#15). Until it lands, login/signup set a simple
 * cookie so the app shell can decide, on the server, whether to render the
 * logged-in chrome (top bar + bottom nav). Reading it in the root layout keeps
 * the first paint correct — no client-only flash of the wrong shell.
 *
 * The set/clear helpers touch `document` and must only run in the browser.
 */
export const AUTH_COOKIE = "poster_auth";

const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function setLoggedIn(): void {
  document.cookie = `${AUTH_COOKIE}=1; path=/; max-age=${MAX_AGE}; samesite=lax`;
}

export function clearLoggedIn(): void {
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/** Client-side read of the mock auth cookie. Safe to call only in the browser. */
export function isLoggedIn(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split("; ")
    .some((c) => c === `${AUTH_COOKIE}=1`);
}
