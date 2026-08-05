/**
 * Re-saving a schedule must not rebuild it.
 *
 * `applySchedule` matches the سانس‌ها it wants against the ones already stored
 * by `startAt.toISOString()` — that is what `@@unique([eventId, startAt])`
 * exists for, and it is why a surviving سانس keeps its row along with its
 * availability, its cancelled flag, and every order that points at it.
 *
 * The match is therefore only as good as the agreement between the two sides.
 * It regenerated instants by appending `Z` to a wall-clock time while the
 * create wizard wrote them in the venue's zone, so after the wizard was fixed
 * *every* key missed: the transaction deleted the entire schedule and built a
 * fresh one three and a half hours late. Silent, total, and triggered by an
 * organiser opening the recurrence editor and pressing save without changing
 * anything.
 *
 * A unit test cannot see this. The corruption is in the round-trip through
 * Postgres, so the guard has to make the round-trip.
 *
 * Note this path is *not* behind `CALENDAR_MODE_ENABLED`. The flag suppresses
 * the editor in the dashboard; `updateEvent` runs `applySchedule` for any patch
 * carrying a `recurrenceSchedule`, so the endpoint is reachable today.
 */

import { it, expect, beforeAll, afterAll } from "vitest";

import { POST } from "@/app/api/events/route";
import { PATCH as PATCH_ONE } from "@/app/api/events/[id]/route";
import type { Event, RecurrenceSchedule } from "@/types";

import { ctx, data, parse, req, describeApi, signInAsOwner } from "./helpers";

const madeEvents: string[] = [];

beforeAll(async () => {
  if (process.env.DATABASE_URL) await signInAsOwner();
});

afterAll(async () => {
  if (!process.env.DATABASE_URL || !madeEvents.length) return;
  const { db } = await import("@/lib/server/db");
  const venues = await db.event.findMany({
    where: { id: { in: madeEvents } },
    select: { venueId: true },
  });
  await db.ticketType.deleteMany({ where: { eventId: { in: madeEvents } } });
  await db.eventSession.deleteMany({ where: { eventId: { in: madeEvents } } });
  await db.event.deleteMany({ where: { id: { in: madeEvents } } });
  await db.venue.deleteMany({
    where: { id: { in: venues.map((v) => v.venueId) }, events: { none: {} } },
  });
  madeEvents.length = 0;
});

/** Two Saturdays, one evening slot — the smallest schedule worth regenerating. */
const SCHEDULE: RecurrenceSchedule = {
  startDate: "2026-09-05",
  endDate: "2026-09-12",
  byDay: ["SA"],
  slots: [{ id: "slot-1", startTime: "18:00", endTime: "20:30" }],
  exceptions: [],
};

async function makeRecurringEvent() {
  const res = await POST(
    req("POST", "/api/events", {
      title: "رویداد تکرارشونده آزمایشی",
      description: "توضیح",
      mode: "recurring",
      venue: { name: "تالار", city: "تهران", address: "نشانی", capacity: 100 },
      sessions: [
        { startAt: "2026-09-05T14:30:00.000Z", endAt: "2026-09-05T17:00:00.000Z" },
      ],
      tags: ["تست"],
    }),
  );
  const parsed = await parse<Event>(res);
  expect(parsed.status).toBe(201);
  const event = data(parsed);
  madeEvents.push(event.id);
  return event;
}

async function applyAndRead(id: string, schedule: RecurrenceSchedule) {
  const res = await PATCH_ONE(
    req("PATCH", `/api/events/${id}`, { recurrenceSchedule: schedule }),
    ctx({ id }),
  );
  expect((await parse<Event>(res)).status).toBe(200);

  const { db } = await import("@/lib/server/db");
  return db.eventSession.findMany({
    where: { eventId: id },
    orderBy: { startAt: "asc" },
    select: { id: true, startAt: true, availability: true, cancelled: true },
  });
}

describeApi("re-saving a recurrence schedule", () => {
  /**
   * The one that actually reproduces the damage.
   *
   * Comparing two consecutive `applySchedule` runs does **not**: with the bug
   * restored, both runs speak the same `Z` dialect, so the keys agree and the
   * rows survive. The corruption only appears where the two conventions *meet*
   * — a سانس written at creation time (venue-local, as `POST /api/events`
   * writes it) and then regenerated. That is the organiser's real sequence:
   * make the event, later open the recurrence editor, press save.
   *
   * 2026-09-05 is a Saturday and the schedule's first occurrence, so this row
   * is one the regenerated schedule wants. It must be kept, not replaced.
   */
  it("keeps the سانس that was created with the event", async () => {
    const event = await makeRecurringEvent();
    const { db } = await import("@/lib/server/db");
    const born = await db.eventSession.findMany({
      where: { eventId: event.id },
      select: { id: true, startAt: true },
    });
    expect(born).toHaveLength(1);

    const after = await applyAndRead(event.id, SCHEDULE);

    expect(after.map((s) => s.id)).toContain(born[0].id);
    expect(
      after.find((s) => s.id === born[0].id)!.startAt.toISOString(),
    ).toBe(born[0].startAt.toISOString());
  });

  it("keeps the very same سانس rows", async () => {
    const event = await makeRecurringEvent();

    const first = await applyAndRead(event.id, SCHEDULE);
    expect(first.length).toBeGreaterThan(0);

    const again = await applyAndRead(event.id, SCHEDULE);

    // Ids, not just count: a rebuilt schedule has the right shape and the
    // wrong rows, which is exactly how this stayed invisible.
    expect(again.map((s) => s.id)).toEqual(first.map((s) => s.id));
    expect(again.map((s) => s.startAt.toISOString())).toEqual(
      first.map((s) => s.startAt.toISOString()),
    );
  });

  it("stores the organiser's wall clock, not the digits with a Z", async () => {
    const event = await makeRecurringEvent();
    const sessions = await applyAndRead(event.id, SCHEDULE);

    // 18:00 at the venue is 14:30Z. The bug stored 18:00Z, which the site then
    // showed back as ۲۱:۳۰.
    for (const s of sessions) {
      expect(s.startAt.toISOString().slice(11, 16)).toBe("14:30");
    }
  });

  it("does not discard a سانس's availability when the schedule is re-saved", async () => {
    const event = await makeRecurringEvent();

    // Flag the سانس created *with the event*, not one that has already been
    // through a regeneration — the same reason as the first test. Marking a
    // post-regeneration row proves nothing, because by then the mismatch that
    // does the damage has already happened.
    const { db } = await import("@/lib/server/db");
    const [before] = await db.eventSession.findMany({
      where: { eventId: event.id },
      select: { id: true },
    });
    await db.eventSession.update({
      where: { id: before.id },
      data: { availability: "FULL", cancelled: true },
    });

    const after = await applyAndRead(event.id, SCHEDULE);
    const same = after.find((s) => s.id === before.id);

    // The organiser marked this سانس cancelled and «تکمیل ظرفیت». Re-saving the
    // schedule must not quietly un-cancel a show people were told was off.
    expect(same).toBeDefined();
    expect(same!.cancelled).toBe(true);
    expect(same!.availability).toBe("FULL");
  });
});
