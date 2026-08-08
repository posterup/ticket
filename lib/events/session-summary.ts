import { formatJalaliDate, formatClock, formatNumber, venueParts } from "@/lib/format";
import { WEEKDAY_LABELS } from "@/lib/wizard/labels";
import type { EventSession, WeekDay } from "@/types";

/**
 * One rendered line of an event's schedule.
 *
 * `sessions` is kept alongside the text so the caller can offer the full list
 * behind a disclosure without regrouping, and so a line that stands for exactly
 * one سانس can still show that سانس's chips.
 */
export interface SessionLine {
  /** Stable key for React — the window plus the first date it occurs on. */
  id: string;
  /** «۱۴ مرداد ۱۴۰۵ الی ۲۰ مرداد ۱۴۰۵», or a single date when there is one. */
  dates: string;
  /** «سه‌شنبه‌ها» / «۹ سانس», or `undefined` when the days are contiguous. */
  qualifier?: string;
  /** «ساعت ۱۶:۰۰ الی ۲۲:۰۰». */
  time: string;
  /** The sessions this line stands for, earliest first. */
  sessions: EventSession[];
}

/** `getUTCDay()` index → iCalendar weekday code, matching `WEEKDAY_LABELS`. */
const WEEKDAY_OF: WeekDay[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** Days between two `YYYY-MM-DD` venue dates. */
function daysApart(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  );
}

/**
 * How to describe a set of dates that is not a solid run.
 *
 * A bare «۶ مرداد الی ۲۱ مهر» reads as *every day for eleven weeks* when it is
 * eleven Tuesdays, so a group with gaps has to say which days. Naming the
 * weekday is the useful answer — the reader learns when to turn up without
 * expanding anything — but it is only honest when the dates actually follow
 * that pattern. «۹ سانس» is the fallback for a set that lands on many weekdays,
 * where listing them all would be longer than the list it replaced and a
 * *wrong* weekday is worse than no weekday at all.
 */
function qualify(dates: string[]): string | undefined {
  if (dates.length < 2) return undefined;
  const contiguous = daysApart(dates[0], dates[dates.length - 1]) === dates.length - 1;
  if (contiguous) return undefined;

  const weekdays = [
    ...new Set(dates.map((d) => WEEKDAY_OF[new Date(`${d}T00:00:00Z`).getUTCDay()])),
  ];
  // Two weekdays is «شنبه‌ها و چهارشنبه‌ها» and still reads as a rule. Beyond
  // that it is a list, not a pattern.
  if (weekdays.length <= 2) {
    return weekdays.map((d) => `${WEEKDAY_LABELS[d]}‌ها`).join(" و ");
  }
  return `${formatNumber(dates.length)} سانس`;
}

/**
 * Collapse an event's سانس‌ها into the fewest honest lines.
 *
 * A multi-day run rendered one line per سانس put thirty near-identical rows on
 * a phone — «۱۴ مرداد · ۱۶:۰۰ تا ۲۲:۰۰», then the fifteenth, then the
 * sixteenth. The dates are the only thing that differs, so the dates are the
 * only thing worth ranging over.
 *
 * **Grouped by clock window, not by date.** An event with a morning and an
 * afternoon سانس is two different things to buy, and merging them into one
 * «۰۹:۰۰ الی ۱۷:۳۰» line would describe a day nobody is selling. Each window
 * therefore keeps its own line *and its own date range*, because they need not
 * run on the same days.
 *
 * **`event.mode` is deliberately not consulted.** A seven-day event created by
 * the wizard reports `mode: "one-time"` — the mode does not reliably follow the
 * sessions that were written — so everything here is derived from the sessions
 * themselves.
 *
 * Sessions that are cancelled or sell assigned seating are **never folded into
 * a group**: their chips say something the summary cannot, and a cancelled date
 * quietly absorbed into a range is a buyer turning up to a locked door.
 */
export function summariseSessions(sessions: EventSession[]): SessionLine[] {
  const sorted = [...sessions].sort((a, b) => a.startAt.localeCompare(b.startAt));

  const groups = new Map<string, EventSession[]>();
  for (const s of sorted) {
    const from = venueParts(s.startAt);
    const to = venueParts(s.endAt);
    // Anything carrying its own chip gets a group of one, keyed by id.
    const solo = s.cancelled || s.layoutVersionId;
    const key = solo ? `solo:${s.id}` : `${from.time}-${to.time}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(s);
    else groups.set(key, [s]);
  }

  return [...groups.values()].map((group) => {
    const first = group[0];
    const last = group[group.length - 1];
    const from = venueParts(first.startAt);
    const to = venueParts(first.endAt);
    const dates = [...new Set(group.map((s) => venueParts(s.startAt).date))];

    return {
      id: `${from.time}-${to.time}-${from.date}`,
      dates:
        dates.length > 1
          ? `${formatJalaliDate(first.startAt)} الی ${formatJalaliDate(last.startAt)}`
          : formatJalaliDate(first.startAt),
      qualifier: qualify(dates),
      time: `ساعت ${formatClock(from.time)} الی ${formatClock(to.time)}`,
      sessions: group,
    };
  });
}
