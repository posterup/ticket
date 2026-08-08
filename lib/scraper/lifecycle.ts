/**
 * Lifecycle: what an event *is right now*, computed from explicit source
 * status first and clock time second — a finished event must never stay
 * public even if the source still lists it.
 *
 * All calendar comparisons happen on Tehran days, never UTC days.
 */

import { TEHRAN_OFFSET_MS, tehranDayString, tehranStartOfDay } from "./dates";
import type { CanonicalEvent, CanonicalSession, Lifecycle } from "./types";

/** End of the Tehran day containing `d`, as a UTC instant. */
export function endOfTehranDay(d: Date): Date {
  return new Date(tehranStartOfDay(d).getTime() + 86_400_000);
}

export function sessionLifecycle(s: CanonicalSession, now: Date): Lifecycle {
  // Explicit source status wins.
  if (s.cancelled || s.sourceStatus === "cancelled") return "cancelled";
  if (s.sourceStatus === "finished") return "finished";

  if (s.dateOnly) {
    // Date-only policy: past day → finished, today → active today, future →
    // upcoming. No end time is ever invented.
    const day = tehranDayString(s.startAt);
    const today = tehranDayString(now);
    if (day < today) return "finished";
    if (day === today) return "ongoing";
    return "upcoming";
  }

  if (now < s.startAt) return "upcoming";
  // A timed session without a stated end stays "ongoing" until its Tehran day
  // ends — the same day-granularity rule as date-only events.
  const end = s.endAt ?? endOfTehranDay(s.startAt);
  return now < end ? "ongoing" : "finished";
}

/**
 * Whole-event state. Precedence: cancelled (event-level) → ongoing → upcoming
 * → cancelled-all-sessions → finished.
 */
export function eventLifecycle(e: CanonicalEvent, now: Date): Lifecycle {
  if (e.sourceStatus === "cancelled") return "cancelled";
  const states = e.sessions.map((s) => sessionLifecycle(s, now));
  if (states.includes("ongoing")) return "ongoing";
  if (states.includes("upcoming")) return "upcoming";
  if (states.length > 0 && states.every((s) => s === "cancelled"))
    return "cancelled";
  return "finished";
}

/** Only these lifecycles may be publicly visible (verification permitting). */
export function isCurrentlyRelevant(lc: Lifecycle): boolean {
  return lc === "upcoming" || lc === "ongoing";
}

/** Sanity guard for impossible dates from a parser bug. */
export function hasPlausibleDates(e: CanonicalEvent, now: Date): boolean {
  const min = now.getTime() - 2 * 365 * 86_400_000;
  const max = now.getTime() + 2 * 365 * 86_400_000;
  return e.sessions.every((s) => {
    const t = s.startAt.getTime();
    return t > min && t < max && (!s.endAt || s.endAt.getTime() >= t);
  });
}

export { TEHRAN_OFFSET_MS };
