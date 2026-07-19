import type { EventMode, EventStatus } from "@/types";

/** Persian labels for event lifecycle status. */
export const STATUS_LABELS: Record<EventStatus, string> = {
  draft: "پیش‌نویس",
  published: "منتشرشده",
  cancelled: "لغوشده",
  completed: "برگزارشده",
};

/** Persian labels for scheduling mode. */
export const MODE_LABELS: Record<EventMode, string> = {
  "one-time": "تک‌جلسه‌ای",
  recurring: "تکرارشونده",
  "multi-session": "چندجلسه‌ای",
};
