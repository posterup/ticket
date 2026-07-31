/**
 * Who owns a seat hold.
 *
 * Checkout is open to guests, so a hold cannot key on a user id. Signed-in
 * buyers key on theirs — so their picks survive switching device — and everyone
 * else gets an opaque, long-lived cookie minted on first hold.
 *
 * This is an identity for *inventory*, not for authentication: it decides who
 * may release a hold, and nothing else. It is deliberately not the session
 * cookie, which is httpOnly, rotated on sign-in, and would drop a guest's
 * selection the moment they logged in mid-checkout.
 */

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

import { getCurrentUser } from "@/lib/server/auth/guards";

export const HOLDER_COOKIE = "poster_holder";

/** Matches the seat-hold TTL's outer bound generously; it is not a secret. */
const HOLDER_TTL_DAYS = 30;

export async function resolveHolderKey(): Promise<string> {
  const user = await getCurrentUser();
  if (user) return `user:${user.id}`;

  const jar = await cookies();
  const existing = jar.get(HOLDER_COOKIE)?.value;
  if (existing) return `anon:${existing}`;

  const minted = randomUUID();
  jar.set(HOLDER_COOKIE, minted, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: HOLDER_TTL_DAYS * 24 * 60 * 60,
  });
  return `anon:${minted}`;
}
