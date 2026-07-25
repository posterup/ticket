import type { EventMode, EventStatus, SessionAvailability } from "@/types";

/** Persian labels for event lifecycle status. */
export const STATUS_LABELS: Record<EventStatus, string> = {
  draft: "پیش‌نویس",
  published: "منتشرشده",
  cancelled: "لغوشده",
  completed: "برگزارشده",
};

/**
 * Persian label for scheduling mode. Only recurring events carry a
 * calendar-style label; one-time and multi-session events show none.
 */
export function modeLabel(mode: EventMode): string | null {
  return mode === "recurring" ? "تکرارشونده" : null;
}

/** Persian labels for a سانس (session) capacity/sales state. */
export const SESSION_AVAILABILITY_LABELS: Record<SessionAvailability, string> = {
  full: "تکمیل ظرفیت",
  "almost-full": "رو به اتمام",
  soon: "به زودی",
  available: "خالی",
};

/** Display order for the availability options an organizer chooses between. */
export const SESSION_AVAILABILITY_ORDER: SessionAvailability[] = [
  "full",
  "almost-full",
  "soon",
  "available",
];
