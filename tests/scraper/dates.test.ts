import { describe, expect, it } from "vitest";

import {
  TEHRAN_OFFSET_MS,
  fakeZTehranToUtc,
  inferJalaliDate,
  jalaliParts,
  tehranDayString,
  tehranParts,
  tehranStartOfDay,
  tehranWallToUtc,
  tehranWeekday,
} from "@/lib/scraper/dates";

describe("fixed Tehran offset", () => {
  it("matches what Intl says for Asia/Tehran (drift detector)", () => {
    // If Iran ever reinstates DST, Intl knows and this constant doesn't.
    for (const iso of ["2026-01-15T12:00:00Z", "2026-07-15T12:00:00Z"]) {
      const d = new Date(iso);
      const wall = tehranParts(d);
      const reconstructed = tehranWallToUtc(
        wall.year,
        wall.month,
        wall.day,
        wall.hour,
        wall.minute,
      );
      expect(reconstructed.getTime()).toBe(d.getTime());
    }
    expect(TEHRAN_OFFSET_MS).toBe(12_600_000);
  });
});

describe("fakeZTehranToUtc", () => {
  it("reinterprets Davvvat's fake-Z stamps as Tehran wall time", () => {
    // "11:30Z" on Davvvat means 11:30 Tehran = 08:00 UTC.
    const d = fakeZTehranToUtc("2026-08-10T11:30:00.000Z");
    expect(d.toISOString()).toBe("2026-08-10T08:00:00.000Z");
    expect(tehranParts(d)).toMatchObject({ hour: 11, minute: 30, day: 10 });
  });
});

describe("tehran day helpers", () => {
  it("day string and start-of-day respect the Tehran boundary", () => {
    // 22:00 UTC = 01:30 next day in Tehran.
    const lateUtc = new Date("2026-08-09T22:00:00Z");
    expect(tehranDayString(lateUtc)).toBe("2026-08-10");
    expect(tehranStartOfDay(lateUtc).toISOString()).toBe(
      "2026-08-09T20:30:00.000Z",
    );
  });
});

describe("jalaliParts", () => {
  it("roundtrips through Intl's persian calendar", () => {
    // 2026-08-09 in Tehran is 18 Mordad 1405 (verified against live Fidibo
    // data: their session day=18, month=مرداد carries week_day یک‌شنبه, and
    // 2026-08-09 is a Sunday).
    const j = jalaliParts(new Date("2026-08-09T12:00:00Z"));
    expect(j).toEqual({ jy: 1405, jm: 5, jd: 18 });
  });
});

describe("inferJalaliDate", () => {
  const hint = new Date("2026-08-03T14:30:00Z");

  it("resolves a year-less Jalali date near the hint, with time", () => {
    const r = inferJalaliDate({
      day: 18,
      monthName: "مرداد",
      time: "19:15",
      weekDay: "یک‌شنبه",
      hint,
    });
    expect(r).not.toBeNull();
    expect(tehranDayString(r!.startAt)).toBe("2026-08-09");
    expect(tehranParts(r!.startAt)).toMatchObject({ hour: 19, minute: 15 });
    expect(r!.dateOnly).toBe(false);
    expect(r!.weekdayMismatch).toBe(false);
  });

  it("flags a weekday mismatch instead of guessing", () => {
    const r = inferJalaliDate({
      day: 18,
      monthName: "مرداد",
      time: null,
      weekDay: "جمعه", // 18 Mordad 1405 is a Sunday, not a Friday
      hint,
    });
    expect(r!.weekdayMismatch).toBe(true);
    expect(r!.dateOnly).toBe(true);
  });

  it("handles the Jalali year boundary (اسفند near Nowruz)", () => {
    // Hint in late March; nearest 29 اسفند is just behind it.
    const r = inferJalaliDate({
      day: 29,
      monthName: "اسفند",
      time: null,
      weekDay: null,
      hint: new Date("2026-03-25T12:00:00Z"),
    });
    expect(r).not.toBeNull();
    const j = jalaliParts(r!.startAt);
    expect(j.jm).toBe(12);
    expect(j.jd).toBe(29);
  });

  it("is ZWNJ/space-insensitive on month and weekday names", () => {
    const r = inferJalaliDate({
      day: 18,
      monthName: " مرداد ",
      time: "19:15",
      weekDay: "یکشنبه",
      hint,
    });
    expect(r!.weekdayMismatch).toBe(false);
  });

  it("returns null for unknown month names", () => {
    expect(
      inferJalaliDate({ day: 1, monthName: "August", time: null, weekDay: null, hint }),
    ).toBeNull();
  });

  it("tehranWeekday: 2026-08-08 is a Saturday", () => {
    expect(tehranWeekday(new Date("2026-08-08T12:00:00Z"))).toBe(6);
  });
});
