/**
 * The session cookie's name, and nothing else.
 *
 * `middleware.ts` runs on the Edge runtime and only needs to know whether this
 * cookie is present. Importing it from `lib/server/auth/session` would drag in
 * `node:crypto` and `next/headers`, which Edge cannot bundle — hence this
 * dependency-free module, shared by both.
 */
export const SESSION_COOKIE = "poster_session";
