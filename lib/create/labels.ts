import type { LocationMode, TicketKind, Visibility } from "./types";

export const LOCATION_LABELS: Record<LocationMode, string> = {
  "in-person": "حضوری",
  online: "آنلاین",
  hybrid: "ترکیبی",
};

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  public: "عمومی",
  unlisted: "خصوصی",
};

export const VISIBILITY_HINTS: Record<Visibility, string> = {
  public: "در صفحهٔ پروفایل شما نمایش داده می‌شود و در موتورهای جست‌وجو ایندکس می‌شود.",
  unlisted:
    "فقط با لینک مستقیم پیدا می‌شود؛ جایی ایندکس نمی‌شود و تنها خودتان آن را در پروفایل و داشبورد خود می‌بینید.",
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
