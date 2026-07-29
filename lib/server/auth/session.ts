/**
 * Opaque session tokens, stored server-side.
 *
 * Not a JWT: sessions must be revocable (logout, "sign out everywhere", a
 * compromised device), and permissions are resolved from the database on every
 * request anyway — so a self-contained token would buy nothing and cost a key
 * rotation story.
 *
 * The raw token exists only in the cookie. The database stores its SHA-256, so
 * a read-only leak of the sessions table cannot be replayed.
 */

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { db } from "../db";

export const SESSION_COOKIE = "poster_session";
export const SESSION_TTL_DAYS = 30;

const TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
/** Only refresh `lastSeenAt` this often, to avoid a write per request. */
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  phone: string;
  fullName: string | null;
  avatarUrl: string | null;
  platformAdmin: boolean;
}

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Issue a session for a user. Returns the raw token — store it nowhere else. */
export async function createSession(
  userId: string,
  meta: { ip?: string; userAgent?: string } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS);

  await db.session.create({
    data: {
      userId,
      tokenHash: hash(token),
      expiresAt,
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });
  await db.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });

  return { token, expiresAt };
}

/**
 * Resolve a raw token to its user, or `null` when it is unknown, expired or
 * revoked.
 */
export async function resolveSession(
  token: string,
): Promise<SessionUser | null> {
  const row = await db.session.findUnique({
    where: { tokenHash: hash(token) },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      lastSeenAt: true,
      user: {
        select: {
          id: true,
          phone: true,
          fullName: true,
          avatarUrl: true,
          platformAdmin: true,
        },
      },
    },
  });

  if (!row || row.revokedAt || row.expiresAt.getTime() < Date.now()) {
    return null;
  }

  if (Date.now() - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.session.update({
      where: { id: row.id },
      data: { lastSeenAt: new Date() },
    });
  }

  return row.user;
}

/** Revoke one session by its raw token. Idempotent. */
export async function revokeSession(token: string): Promise<void> {
  await db.session.updateMany({
    where: { tokenHash: hash(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Revoke every live session for a user. Returns how many were revoked. */
export async function revokeAllSessions(userId: string): Promise<number> {
  const { count } = await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count;
}

/**
 * `sameSite: "lax"` is required, not incidental: the payment gateway returns
 * the buyer via a cross-site top-level redirect, and `strict` would withhold
 * the cookie on that first request and log them out mid-checkout.
 */
export async function setSessionCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** The raw token from the request cookie, if present. */
export async function readSessionCookie(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}
