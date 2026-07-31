/**
 * Times, and which of them are instants.
 *
 * Three bugs in the create wizard came from confusing the two:
 *
 *  - a typed `18:00` stored as `18:00Z`, three and a half hours off, on every
 *    event made through the wizard and on the calendar entry its buyers get;
 *  - stored instants rendered in *the viewer's* zone, so the two halves only
 *    agreed on a machine set to UTC;
 *  - a wall-clock string with no date routed through `1970-01-01T…Z` to be
 *    formatted, which is a real moment in 1970 and renders as ۲۱:۳۰ in Tehran.
 *
 * A time with no date is not an instant, and the only way to make one is to
 * invent a date.
 */

import { describe, it, expect } from "vitest";

import {
  formatClock,
  formatJalaliDate,
  formatTime,
  venueIso,
  venueParts,
  VENUE_TIME_ZONE,
} from "@/lib/format";

/**
 * The real conversion both editors use — not a re-spelling of it.
 *
 * This helper used to inline `+03:30` itself, which meant the suite proved the
 * literal matched itself while the wizard and the dashboard were free to drift
 * apart. They had: the wizard wrote venue-local, the dashboard read UTC.
 */
const stored = venueIso;

describe("a typed time, round-tripped", () => {
  it("comes back as the time that was typed", () => {
    expect(formatTime(stored("2026-08-05", "18:00"))).toBe("۱۸:۰۰");
    expect(formatTime(stored("2026-08-05", "09:05"))).toBe("۰۹:۰۵");
  });

  it("is stored as a true instant, not the digits with a Z", () => {
    // The old behaviour was `2026-08-05T18:00:00.000Z`.
    expect(stored("2026-08-05", "18:00")).toBe("2026-08-05T14:30:00.000Z");
  });

  it("survives midnight, where the offset changes the date", () => {
    // 00:30 in Tehran is the previous day in UTC; the venue still sees 00:30.
    const late = stored("2026-08-05", "00:30");
    expect(late).toBe("2026-08-04T21:00:00.000Z");
    expect(formatTime(late)).toBe("۰۰:۳۰");
  });
});

describe("the edit form shows what the row beside it shows", () => {
  /**
   * The dashboard's session editor populated its fields by slicing the ISO
   * string — `startAt.slice(11, 16)` — which is UTC. A session at 18:00 showed
   * «۱۸:۰۰» in the list and `14:30` in the form directly below it. Saving was
   * lossless, so nothing rotted on its own; the damage came from an organiser
   * correcting 14:30 to the 18:00 they meant, moving the show to 21:30.
   */
  it("reads back the wall clock, not the UTC digits", () => {
    const at = stored("2026-08-05", "18:00");
    expect(at).toBe("2026-08-05T14:30:00.000Z"); // the slice would give "14:30"
    expect(venueParts(at)).toEqual({ date: "2026-08-05", time: "18:00" });
  });

  it("agrees with what the list row renders", () => {
    for (const time of ["18:00", "09:05", "23:45", "00:30"]) {
      const at = stored("2026-08-05", time);
      expect(formatClock(venueParts(at).time)).toBe(formatTime(at));
    }
  });

  it("survives an open-and-save with no edit", () => {
    // The organiser opens the editor and saves without touching anything. The
    // instant must be the one they started with, to the millisecond.
    //
    // This is also what protects `applySchedule`: it matches existing سانس‌ها
    // against the regenerated ones by `startAt.toISOString()`, so any drift in
    // this round-trip is not a display bug — every key misses, and the
    // transaction deletes every سانس and rebuilds it, discarding availability,
    // the cancelled flag, and the rows orders point at.
    for (const [date, time] of [
      ["2026-08-05", "18:00"],
      ["2026-08-05", "00:30"], // previous day in UTC
      ["2026-12-31", "23:59"], // year boundary
      ["2026-03-21", "00:00"], // نوروز, and midnight
    ]) {
      const at = stored(date, time);
      const reopened = venueParts(at);
      expect(stored(reopened.date, reopened.time)).toBe(at);
    }
  });

  it("puts a past-midnight session on the venue's day, not UTC's", () => {
    // 00:30 Tehran is 21:00 the *previous* day in UTC. An editor slicing the
    // ISO string would offer the organiser the wrong date, too — not just the
    // wrong time.
    const at = stored("2026-08-05", "00:30");
    expect(at.slice(0, 10)).toBe("2026-08-04");
    expect(venueParts(at).date).toBe("2026-08-05");
  });
});

describe("display is pinned to the venue, not the viewer", () => {
  it("names a zone rather than trusting the machine", () => {
    expect(VENUE_TIME_ZONE).toBe("Asia/Tehran");
  });

  it("keeps a date-only value on its own day", () => {
    // Written as `T00:00:00.000Z` in several places. Rendered in a zone west
    // of UTC that is the *previous* day; in Tehran it is 03:30 the same day.
    const day = formatJalaliDate("2026-08-05T00:00:00.000Z");
    expect(day).toContain("۱۴"); // ۱۴ مرداد ۱۴۰۵
  });
});

describe("a wall clock is not an instant", () => {
  it("renders the digits it was given", () => {
    expect(formatClock("18:00")).toBe("۱۸:۰۰");
    expect(formatClock("09:05")).toBe("۰۹:۰۵");
    expect(formatClock("7:30")).toBe("۷:۳۰");
  });

  it("does not shift by the venue offset", () => {
    // The bug: `formatTime("1970-01-01T18:00:00.000Z")` is ۲۱:۳۰.
    expect(formatClock("18:00")).not.toBe(
      formatTime("1970-01-01T18:00:00.000Z"),
    );
  });

  it("leaves a half-typed field alone rather than making it NaN", () => {
    for (const partial of ["", "1", "18:", "abc"]) {
      expect(formatClock(partial)).toBe(partial);
    }
  });
});
