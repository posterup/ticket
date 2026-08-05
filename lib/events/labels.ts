import type { EventMode, EventStatus, SessionAvailability } from "@/types";
import { CALENDAR_MODE_ENABLED } from "@/lib/flags";

/** Persian labels for event lifecycle status. */
export const STATUS_LABELS: Record<EventStatus, string> = {
  draft: "پیش‌نویس",
  published: "منتشرشده",
  cancelled: "لغوشده",
  completed: "برگزارشده",
};

/**
 * Persian label for scheduling mode. Only recurring events carry a
 * calendar-style label; one-time and multi-session events show none. The label
 * is suppressed entirely while calendar mode is disabled (see {@link CALENDAR_MODE_ENABLED}).
 */
export function modeLabel(mode: EventMode): string | null {
  return mode === "recurring" && CALENDAR_MODE_ENABLED ? "تقویمی" : null;
}

/** Persian labels for a سانس (session) capacity/sales state. */
export const SESSION_AVAILABILITY_LABELS: Record<SessionAvailability, string> = {
  full: "تکمیل ظرفیت",
  "almost-full": "رو به اتمام",
  // «به‌زودی» with the ZWNJ, matching `resolveBuyState`'s badge — the two can
  // land on one screen (the event page badge above the سانس picker), and the
  // same word spelled two ways reads as two different states.
  soon: "به‌زودی",
  // «در حال فروش», with the space: «درحال» is a typo, and «در حال …» is the
  // form every other progress label in the product uses («در حال ثبت…»).
  available: "در حال فروش",
};

/** Display order for the availability options an organizer chooses between. */
export const SESSION_AVAILABILITY_ORDER: SessionAvailability[] = [
  "full",
  "almost-full",
  "soon",
  "available",
];
