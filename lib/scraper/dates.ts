/**
 * Tehran-aware date handling and Jalali conversion, on Intl alone — no date
 * dependency. Iran abolished DST in 2022, so Asia/Tehran is a fixed UTC+3:30;
 * the constant below is safe until Iranian law changes, at which point
 * `tehranParts` (Intl-based, always correct) disagrees with it and the unit
 * tests catch the drift.
 */

export const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;

/**
 * Davvvat stamps Tehran wall-clock time with a fake `Z` suffix
 * ("2026-08-10T11:30:00.000Z" means 11:30 in Tehran, not UTC — verified
 * against the site's rendered pages). Reinterpret accordingly.
 */
export function fakeZTehranToUtc(iso: string): Date {
  return new Date(Date.parse(iso) - TEHRAN_OFFSET_MS);
}

export interface WallParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const tehranFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tehran",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Gregorian wall-clock parts of a UTC instant, in Tehran. */
export function tehranParts(date: Date): WallParts {
  const p: Record<string, string> = {};
  for (const part of tehranFmt.formatToParts(date)) p[part.type] = part.value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
  };
}

/** "YYYY-MM-DD" of a UTC instant as seen in Tehran. */
export function tehranDayString(date: Date): string {
  const { year, month, day } = tehranParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** UTC instant for a Tehran wall-clock time. */
export function tehranWallToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - TEHRAN_OFFSET_MS);
}

/** Tehran midnight (start of day) of a UTC instant, as a UTC instant. */
export function tehranStartOfDay(date: Date): Date {
  const { year, month, day } = tehranParts(date);
  return tehranWallToUtc(year, month, day);
}

// ───────────────────────────── Jalali ─────────────────────────────

export const PERSIAN_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

/** Weekday name → JS getUTCDay() index (Sun=0). ZWNJ-insensitive keys. */
const PERSIAN_WEEKDAYS: Record<string, number> = {
  "یکشنبه": 0,
  "دوشنبه": 1,
  "سهشنبه": 2,
  "چهارشنبه": 3,
  "پنجشنبه": 4,
  "جمعه": 5,
  "شنبه": 6,
};

function weekdayIndex(name: string): number | null {
  const key = name.replace(/[\s‌]/g, "");
  return PERSIAN_WEEKDAYS[key] ?? null;
}

const jalaliFmt = new Intl.DateTimeFormat("en-CA-u-ca-persian", {
  timeZone: "Asia/Tehran",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

export interface JalaliParts {
  jy: number;
  jm: number;
  jd: number;
}

/** Jalali calendar date of a UTC instant, as seen in Tehran. */
export function jalaliParts(date: Date): JalaliParts {
  const p: Record<string, string> = {};
  for (const part of jalaliFmt.formatToParts(date)) p[part.type] = part.value;
  // Intl renders persian years as e.g. "1405 AP" in some ICU builds; year
  // part itself is numeric.
  return { jy: Number(p.year), jm: Number(p.month), jd: Number(p.day) };
}

/** Tehran weekday index (Sun=0) of a UTC instant. */
export function tehranWeekday(date: Date): number {
  return new Date(date.getTime() + TEHRAN_OFFSET_MS).getUTCDay();
}

export interface JalaliInferenceInput {
  /** Jalali day of month, 1–31. */
  day: number;
  /** Persian month name, e.g. "مرداد". */
  monthName: string;
  /** "HH:mm" Tehran wall time; null = date-only. */
  time: string | null;
  /** Persian weekday name for cross-checking, e.g. "یک‌شنبه". */
  weekDay: string | null;
  /** A nearby known instant (e.g. sales_started_at) used to pick the year. */
  hint: Date;
}

export interface JalaliInferenceResult {
  startAt: Date;
  dateOnly: boolean;
  /** True when the source's weekday disagrees with the inferred date. */
  weekdayMismatch: boolean;
}

/**
 * Resolve a year-less Jalali date ("۱۸ مرداد، یک‌شنبه، ۱۹:۱۵") to a UTC
 * instant. The month/day pair recurs once per Jalali year; the candidate
 * closest to `hint` wins. The source's stated weekday is then checked against
 * the inferred date — a mismatch is reported, never silently corrected.
 * Returns null when the month name is unknown or no candidate matches.
 */
export function inferJalaliDate(
  input: JalaliInferenceInput,
): JalaliInferenceResult | null {
  const fold = (s: string) => s.replace(/[\s‌]/g, "");
  const jm =
    PERSIAN_MONTHS.findIndex((m) => fold(m) === fold(input.monthName)) + 1;
  if (jm === 0 || input.day < 1 || input.day > 31) return null;

  // The month/day pair recurs once per ~365-day Jalali year, so scanning
  // outward from the hint finds the nearest candidate first and stops there.
  const base = tehranStartOfDay(input.hint);
  let dayStart: Date | null = null;
  for (let distance = 0; distance <= 400 && !dayStart; distance++) {
    for (const offset of distance === 0 ? [0] : [distance, -distance]) {
      const day = new Date(base.getTime() + offset * 86_400_000);
      const j = jalaliParts(day);
      if (j.jm === jm && j.jd === input.day) {
        dayStart = day;
        break;
      }
    }
  }
  if (!dayStart) return null;

  let startAt = dayStart;
  let dateOnly = true;
  if (input.time) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(input.time.trim());
    if (m) {
      startAt = new Date(
        dayStart.getTime() + Number(m[1]) * 3_600_000 + Number(m[2]) * 60_000,
      );
      dateOnly = false;
    }
  }

  let weekdayMismatch = false;
  if (input.weekDay) {
    const expected = weekdayIndex(input.weekDay);
    if (expected !== null && expected !== tehranWeekday(dayStart)) {
      weekdayMismatch = true;
    }
  }
  return { startAt, dateOnly, weekdayMismatch };
}
