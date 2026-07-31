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
  // Remembered so it can be deleted, not merely forgotten: `signOut` used to
  // drop the cookie and leave the row, and the suite was minting eighty
  // sessions a run that nothing ever removed.
  minted.add(token);
  return user.id;
}

/**
 * Session tokens this process created.
 *
 * Stored raw and hashed on the way out: the table keys on `tokenHash`, because
 * the raw token is meant to exist only in the cookie.
 */
const minted = new Set<string>();

const tokenHash = async (token: string) =>
  (await import("node:crypto")).createHash("sha256").update(token).digest("hex");

/** Sign in as the seeded owner of `ava-events`, who manages the fixtures. */
export function signInAsOwner(): Promise<string> {
  return signInAs(SEEDED_OWNER);
}

/**
 * Drop the session, so the next call is anonymous.
 *
 * Deletes the row as well as the cookie. A signed-out browser and a deleted
 * session are the same thing to every guard, and leaving the row behind grew
 * the table by eighty per run — invisible, because `Session` was not among the
 * tables the drift check watched.
 */
export async function signOut(): Promise<void> {
  const { SESSION_COOKIE } = await import("@/lib/session-cookie");
  const token = jar().get(SESSION_COOKIE);
  jar().delete(SESSION_COOKIE);
  if (!token || !process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");
  await db.session.deleteMany({ where: { tokenHash: await tokenHash(token) } });
  minted.delete(token);
}

/**
 * Every session this process made, for suites that sign in and never out.
 * Safe to call more than once.
 */
export async function dropMintedSessions(): Promise<void> {
  if (!process.env.DATABASE_URL || minted.size === 0) return;
  const { db } = await import("@/lib/server/db");
  const hashes = await Promise.all([...minted].map(tokenHash));
  await db.session.deleteMany({ where: { tokenHash: { in: hashes } } });
  minted.clear();
}

/**
 * Undo an order's effect on `TicketType.sold` / `reserved`.
 *
 * Deleting an order row does **not** put its inventory back: the counters are
 * denormalised, and `createOrder`/`markOrderPaid` moved them. Suites that build
 * orders and then delete them were therefore leaving the numbers a little
 * higher every run — a slow corruption invisible until «بلیت زودهنگام» reached
 * its 200 capacity and unrelated tests began failing with SOLD_OUT.
 *
 * Call this *before* deleting the orders, while their items are still readable.
 */
export async function restoreInventory(orderIds: string[]): Promise<void> {
  if (!orderIds.length || !process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");

  const orders = await db.order.findMany({
    where: { id: { in: orderIds } },
    select: {
      status: true,
      items: { select: { ticketTypeId: true, quantity: true } },
    },
  });

  for (const order of orders) {
    // PAID moved the count into `sold`; anything still open is holding
    // `reserved`. A refunded order already gave both back.
    const column =
      order.status === "PAID"
        ? "sold"
        : order.status === "PENDING_PAYMENT"
          ? "reserved"
          : null;
    if (!column) continue;

    for (const item of order.items) {
      await db.ticketType.update({
        where: { id: item.ticketTypeId },
        data: { [column]: { decrement: item.quantity } },
      });
    }
  }
}

/**
 * Events a suite created, so they can be taken away again.
 *
 * Six suites build a throwaway event (plus its venue, ticket types, sessions
 * and orders) through the real API and delete none of it. Measured across two
 * consecutive full runs, the database grew by ~54 events, ~55 venues, ~49
 * ticket types and ~37 orders **every time** — unbounded, and quietly poisoning
 * anything that picks a fixture with `findFirst`.
 *
 * Register the id at creation; `dropTrackedEvents()` in `afterAll` removes the
 * whole tree in foreign-key order.
 */
const trackedEvents = new Set<string>();

/**
 * Venues are tracked separately, not inferred from their events.
 *
 * The first version read `venueId` off the events it was about to delete, so
 * anything that removed an event first — or an early return when the set was
 * already empty — lost the only link to its venue and left it orphaned
 * forever. A venue outlives its event by design; the cleanup has to know about
 * it independently.
 */
const trackedVenues = new Set<string>();

export function trackEvent(id: string): string {
  trackedEvents.add(id);
  return id;
}

export function trackVenue(id: string): string {
  trackedVenues.add(id);
  return id;
}

export async function dropTrackedEvents(): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  if (trackedEvents.size === 0 && trackedVenues.size === 0) return;
  const { db } = await import("@/lib/server/db");
  const ids = [...trackedEvents];
  const venueIds = [...trackedVenues];
  trackedEvents.clear();
  trackedVenues.clear();

  const events = await db.event.findMany({
    where: { id: { in: ids } },
    select: { id: true, venueId: true },
  });
  const eventIds = events.map((e) => e.id);
  if (!eventIds.length) {
    // Nothing left to unwind, but a venue may still be orphaned.
    await dropOrphanVenues(venueIds);
    return;
  }
  const orders = await db.order.findMany({
    where: { eventId: { in: eventIds } },
    select: { id: true },
  });
  const orderIds = orders.map((o) => o.id);
  const sessions = await db.eventSession.findMany({
    where: { eventId: { in: eventIds } },
    select: { id: true },
  });
  const sessionIds = sessions.map((s) => s.id);

  // Children first: every one of these is a foreign key into something below.
  await db.checkIn.deleteMany({ where: { ticket: { orderId: { in: orderIds } } } });
  await db.ticket.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.payment.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.seatHold.deleteMany({ where: { sessionId: { in: sessionIds } } });
  await db.seatStatus.deleteMany({ where: { sessionId: { in: sessionIds } } });
  await db.order.deleteMany({ where: { id: { in: orderIds } } });

  await db.discountRedemption.deleteMany({
    where: { discountCode: { eventId: { in: eventIds } } },
  });
  await db.discountCode.deleteMany({ where: { eventId: { in: eventIds } } });
  await db.eventCollaborator.deleteMany({ where: { eventId: { in: eventIds } } });
  await db.eventRegistration.deleteMany({ where: { eventId: { in: eventIds } } });
  await db.eventGuest.deleteMany({ where: { eventId: { in: eventIds } } });
  await db.notifySubscription.deleteMany({ where: { eventId: { in: eventIds } } });
  await db.bookmark.deleteMany({ where: { eventId: { in: eventIds } } });
  await db.waitlistEntry.deleteMany({ where: { eventId: { in: eventIds } } });
  await db.sessionSectionPricing.deleteMany({ where: { eventId: { in: eventIds } } });
  await db.ticketType.deleteMany({ where: { eventId: { in: eventIds } } });
  await db.eventSession.deleteMany({ where: { eventId: { in: eventIds } } });
  await db.event.deleteMany({ where: { id: { in: eventIds } } });

  await dropOrphanVenues([...venueIds, ...events.map((e) => e.venueId)]);
}

/** Remove venues nothing points at any more. */
async function dropOrphanVenues(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { db } = await import("@/lib/server/db");
  await db.venue.deleteMany({
    where: { id: { in: [...new Set(ids)] }, events: { none: {} } },
  });
}
