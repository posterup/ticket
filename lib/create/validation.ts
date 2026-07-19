import { expandSessions, type CreateDraft } from "./types";

export type DraftErrors = Record<string, string>;

/**
 * Validate the composer draft. Returns a flat map of field-key -> Persian
 * message; an empty map means the draft is submittable. Keys are namespaced so
 * the composer can show them next to the relevant section/ticket.
 */
export function validateDraft(draft: CreateDraft): DraftErrors {
  const e: DraftErrors = {};

  if (!draft.title.trim()) e.title = "عنوان رویداد الزامی است.";

  const { mode, venueName, city, onlineUrl } = draft.location;
  if (mode !== "online") {
    if (!venueName.trim()) e.venueName = "نام محل الزامی است.";
    if (!city.trim()) e.city = "شهر الزامی است.";
  }
  if (mode !== "in-person" && !onlineUrl.trim()) {
    e.onlineUrl = "نشانی آنلاین الزامی است.";
  }

  const sessions = expandSessions(draft);
  if (sessions.length === 0) {
    e.sessions = "حداقل یک تاریخ برای رویداد تعیین کنید.";
  } else if (draft.sessions.some((s) => s.date && (!s.startTime || !s.endTime))) {
    e.sessions = "برای هر جلسه ساعت شروع و پایان را کامل کنید.";
  }

  if (draft.visibility === "private" && !draft.requireApproval && !draft.accessCode.trim()) {
    e.privacy = "برای رویداد خصوصی، کد دسترسی بگذارید یا تأیید را فعال کنید.";
  }

  if (draft.ticketTypes.length === 0) {
    e.tickets = "حداقل یک نوع بلیت اضافه کنید.";
  }
  for (const t of draft.ticketTypes) {
    if (!t.name.trim()) {
      e[`ticket-${t.id}`] = "نام بلیت الزامی است.";
      continue;
    }
    if (t.kind === "paid" || t.kind === "group" || t.kind === "addon") {
      const price = Number(t.price);
      if (!Number.isFinite(price) || price <= 0) {
        e[`ticket-${t.id}`] = "قیمت را وارد کنید.";
        continue;
      }
    }
    if (t.kind === "donation") {
      const min = Number(t.minPrice);
      if (!Number.isFinite(min) || min < 0) {
        e[`ticket-${t.id}`] = "حداقل مبلغ نامعتبر است.";
        continue;
      }
    }
    if (t.kind === "group") {
      const size = Number(t.groupSize);
      if (!Number.isInteger(size) || size < 2) {
        e[`ticket-${t.id}`] = "تعداد افراد گروه باید حداقل ۲ باشد.";
        continue;
      }
    }
    const min = Number(t.minPerOrder);
    const max = Number(t.maxPerOrder);
    if (Number.isFinite(min) && Number.isFinite(max) && max < min) {
      e[`ticket-${t.id}`] = "حداکثر تعداد نباید کمتر از حداقل باشد.";
      continue;
    }
    if (t.earlyBird) {
      const p = Number(t.earlyBirdPrice);
      if (!Number.isFinite(p) || p < 0) {
        e[`ticket-${t.id}`] = "قیمت زودهنگام نامعتبر است.";
      } else if (!t.earlyBirdUntil) {
        e[`ticket-${t.id}`] = "تاریخ پایان فروش زودهنگام را تعیین کنید.";
      }
    }
    if (t.buyout) {
      const base = Number(t.buyoutBasePrice);
      const perPerson = Number(t.buyoutPerPerson);
      const bMin = Number(t.buyoutMin);
      const bMax = Number(t.buyoutMax);
      if (!Number.isFinite(base) || base < 0 || !Number.isFinite(perPerson) || perPerson < 0) {
        e[`ticket-${t.id}`] = "قیمت‌های دربستی نامعتبر است.";
      } else if (!Number.isInteger(bMin) || bMin < 1 || !Number.isInteger(bMax) || bMax < bMin) {
        e[`ticket-${t.id}`] = "حداقل و حداکثر نفرات دربستی نامعتبر است.";
      }
    }
  }

  return e;
}
