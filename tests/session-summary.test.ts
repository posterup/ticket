import { describe, it, expect } from "vitest";

import { summariseSessions } from "@/lib/events/session-summary";
import type { EventSession } from "@/types";

/**
 * A سانس at a Tehran wall-clock time.
 *
 * `12:30Z` is `16:00` in Tehran, which is why the fixtures below look offset:
 * the summary reads the venue clock, and a test written in UTC would agree with
 * a broken implementation.
 */
function session(
  date: string,
  startUtc: string,
  endUtc: string,
  extra: Partial<EventSession> = {},
): EventSession {
  return {
    id: `${date}-${startUtc}`,
    eventId: "e1",
    startAt: `${date}T${startUtc}:00.000Z`,
    endAt: `${date}T${endUtc}:00.000Z`,
    ...extra,
  };
}

/** Seven consecutive days, all 16:00–22:00 Tehran. */
const week = [
  "2026-08-05",
  "2026-08-06",
  "2026-08-07",
  "2026-08-08",
  "2026-08-09",
  "2026-08-10",
  "2026-08-11",
].map((d) => session(d, "12:30", "18:30"));

describe("summariseSessions", () => {
  it("collapses a contiguous run into one dated range", () => {
    const [line, ...rest] = summariseSessions(week);
    expect(rest).toHaveLength(0);
    expect(line.dates).toBe("۱۴ مرداد ۱۴۰۵ الی ۲۰ مرداد ۱۴۰۵");
    expect(line.time).toBe("ساعت ۱۶:۰۰ الی ۲۲:۰۰");
    // Contiguous days need no qualifier — the range already says every day.
    expect(line.qualifier).toBeUndefined();
    expect(line.sessions).toHaveLength(7);
  });

  it("keeps a single سانس as a single date", () => {
    const [line] = summariseSessions([week[0]]);
    expect(line.dates).toBe("۱۴ مرداد ۱۴۰۵");
    expect(line.qualifier).toBeUndefined();
  });

  it("gives each clock window its own line", () => {
    // A morning and an afternoon سانس on the same day are two things to buy;
    // merging them would advertise 09:00–17:30, which nobody is selling.
    const lines = summariseSessions([
      session("2026-09-05", "05:30", "09:30"),
      session("2026-09-05", "11:00", "14:00"),
    ]);
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.time)).toEqual([
      "ساعت ۰۹:۰۰ الی ۱۳:۰۰",
      "ساعت ۱۴:۳۰ الی ۱۷:۳۰",
    ]);
  });

  it("names the weekday when the days have gaps", () => {
    // Four Tuesdays. A bare range here would read as twenty-two days.
    const tuesdays = ["2026-08-04", "2026-08-11", "2026-08-18", "2026-08-25"].map(
      (d) => session(d, "15:30", "17:30"),
    );
    expect(summariseSessions(tuesdays)[0].qualifier).toBe("سه‌شنبه‌ها");
  });

  it("falls back to a count when the gaps follow no weekday pattern", () => {
    const irregular = ["2026-08-05", "2026-08-09", "2026-08-14", "2026-08-23"].map(
      (d) => session(d, "12:30", "18:30"),
    );
    expect(summariseSessions(irregular)[0].qualifier).toBe("۴ سانس");
  });

  it("never folds a cancelled سانس into a range", () => {
    const withCancelled = [
      ...week,
      session("2026-08-12", "12:30", "18:30", { cancelled: true }),
    ];
    const lines = summariseSessions(withCancelled);
    expect(lines).toHaveLength(2);
    const solo = lines.find((l) => l.sessions[0].cancelled);
    expect(solo?.sessions).toHaveLength(1);
    expect(solo?.dates).toBe("۲۱ مرداد ۱۴۰۵");
  });

  it("never folds a seated سانس into a range", () => {
    const lines = summariseSessions([
      ...week,
      session("2026-08-12", "12:30", "18:30", { layoutVersionId: "v1" }),
    ]);
    expect(lines).toHaveLength(2);
    expect(lines.some((l) => l.sessions[0].layoutVersionId === "v1")).toBe(true);
  });

  it("orders sessions within a line earliest first", () => {
    const shuffled = [week[3], week[0], week[6], week[1]];
    const [line] = summariseSessions(shuffled);
    expect(line.sessions.map((s) => s.startAt)).toEqual(
      [week[0], week[1], week[3], week[6]].map((s) => s.startAt),
    );
  });
});
