import type { LocationMode, TicketKind, Visibility } from "./types";

export const LOCATION_LABELS: Record<LocationMode, string> = {
  "in-person": "حضوری",
  online: "آنلاین",
  hybrid: "ترکیبی",
};

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  public: "عمومی",
  unlisted: "با لینک",
};

export const VISIBILITY_HINTS: Record<Visibility, string> = {
  public: "در کشف رویدادها و صفحهٔ شما نمایش داده می‌شود.",
  unlisted: "فقط با لینک مستقیم قابل دسترسی است؛ در فهرست‌ها دیده نمی‌شود.",
};

export const TICKET_KIND_LABELS: Record<TicketKind, string> = {
  paid: "پولی",
  free: "رایگان",
  donation: "کمک مالی",
  group: "گروهی",
  addon: "افزودنی",
};

export const TICKET_KIND_HINTS: Record<TicketKind, string> = {
  paid: "قیمت ثابت برای هر بلیت.",
  free: "ثبت‌نام رایگان با ظرفیت مشخص.",
  donation: "خریدار مبلغ دلخواه بالاتر از حداقل می‌پردازد.",
  group: "بستهٔ چندنفره در یک خرید.",
  addon: "مورد اختیاری در کنار بلیت (مثل پارکینگ).",
};
