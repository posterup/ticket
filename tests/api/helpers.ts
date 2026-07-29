/**
 * Helpers for exercising Route Handlers directly.
 *
 * The handlers are plain functions over `lib/server`, so they can be called
 * in-process without booting Next. That keeps the API contract — status codes
 * and error envelopes — under test without an HTTP server.
 */

import { describe } from "vitest";

import type { ApiResponse } from "@/types";

const BASE = "http://test.local";

/**
 * `describe` for suites that exercise handlers against the database.
 *
 * Skips without `DATABASE_URL` so a fresh clone and CI stay green; run
 * `npm run db:reset` to exercise them.
 */
export const describeApi = describe.skipIf(!process.env.DATABASE_URL);

/** A JSON request. Pass a raw string as `body` to exercise malformed JSON. */
export function req(
  method: string,
  path: string,
  body?: unknown,
): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
  });
}

/** The `{ params }` context Next passes as a handler's second argument. */
export function ctx<T extends Record<string, string>>(
  params: T,
): { params: Promise<T> } {
  return { params: Promise.resolve(params) };
}

export interface Parsed<T> {
  status: number;
  body: ApiResponse<T>;
}

/** Await a handler response into `{ status, body }`. */
export async function parse<T>(res: Response): Promise<Parsed<T>> {
  return { status: res.status, body: (await res.json()) as ApiResponse<T> };
}

/** Narrow to the success payload, failing loudly when the call errored. */
export function data<T>(parsed: Parsed<T>): T {
  if ("error" in parsed.body) {
    throw new Error(
      `expected success, got ${parsed.status} ${parsed.body.error.code}: ${parsed.body.error.message}`,
    );
  }
  return parsed.body.data;
}

/** The machine-readable code of an error envelope. */
export function errorCode<T>(parsed: Parsed<T>): string {
  if (!("error" in parsed.body)) throw new Error("expected an error envelope");
  return parsed.body.error.code;
}

/** The cookie jar installed by `tests/setup/cookies.ts`. */
function jar(): Map<string, string> {
  return (globalThis as unknown as { __cookieJar: Map<string, string> })
    .__cookieJar;
}

/** Phones seeded by `prisma/seed.ts`, one owner per workspace. */
export const SEEDED_OWNER = "09120000001";

/**
 * Sign in as an existing user by minting a real session, so the guards resolve
 * exactly as they would for a browser. Returns the user id.
 */
export async function signInAs(phone: string): Promise<string> {
  const { db } = await import("@/lib/server/db");
  const { createSession } = await import("@/lib/server/auth/session");
  const { SESSION_COOKIE } = await import("@/lib/session-cookie");

  const user = await db.user.upsert({
    where: { phone },
    create: { phone },
    update: {},
    select: { id: true },
  });
  const { token } = await createSession(user.id);
  jar().set(SESSION_COOKIE, token);
  return user.id;
}

/** Sign in as the seeded owner of `ava-events`, who manages the fixtures. */
export function signInAsOwner(): Promise<string> {
  return signInAs(SEEDED_OWNER);
}

/** Drop the session, so the next call is anonymous. */
export async function signOut(): Promise<void> {
  const { SESSION_COOKIE } = await import("@/lib/session-cookie");
  jar().delete(SESSION_COOKIE);
}
