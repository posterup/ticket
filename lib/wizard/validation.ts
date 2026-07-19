import type { EventInfoForm, TicketTypeForm, WizardState } from "./types";

export type Errors = Record<string, string>;

function isPositiveInt(value: string): boolean {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 && String(n) === value.trim();
}

function isNonNegativeInt(value: string): boolean {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n >= 0 && String(n) === value.trim();
}

/** Step 1 - event information. */
export function validateEventInfo(event: EventInfoForm): Errors {
  const e: Errors = {};
  if (!event.title.trim()) e.title = "عنوان رویداد الزامی است.";
  if (!event.venue.name.trim()) e.venueName = "نام محل الزامی است.";
  if (!event.venue.city.trim()) e.venueCity = "شهر الزامی است.";
  if (!event.venue.address.trim()) e.venueAddress = "آدرس الزامی است.";
  if (!isPositiveInt(event.venue.capacity)) {
    e.venueCapacity = "ظرفیت باید عددی بزرگ‌تر از صفر باشد.";
  }
  return e;
}

/** Step 2 - schedule and availability. */
export function validateSchedule(state: WizardState): Errors {
  const e: Errors = {};
  if (state.mode === "one-time") {
    const { date, startTime, endTime } = state.oneTime;
    if (!date) e.date = "تاریخ الزامی است.";
    if (!startTime) e.startTime = "زمان شروع الزامی است.";
    if (!endTime) e.endTime = "زمان پایان الزامی است.";
    if (startTime && endTime && endTime <= startTime) {
      e.endTime = "زمان پایان باید بعد از زمان شروع باشد.";
    }
  } else {
    const r = state.recurring;
    if (!isPositiveInt(r.interval)) e.recInterval = "بازه تکرار باید حداقل ۱ باشد.";
    if (!r.date) e.recDate = "تاریخ اولین جلسه الزامی است.";
    if (!r.startTime) e.recStartTime = "زمان شروع الزامی است.";
    if (!r.endTime) e.recEndTime = "زمان پایان الزامی است.";
    if (r.startTime && r.endTime && r.endTime <= r.startTime) {
      e.recEndTime = "زمان پایان باید بعد از زمان شروع باشد.";
    }
    if (r.until && r.date && r.until < r.date) {
      e.recUntil = "پایان سری باید بعد از تاریخ شروع باشد.";
    }
  }
  return e;
}

/** Step 3 - ticket types. Keys are namespaced by the ticket's local id. */
export function validateTickets(ticketTypes: TicketTypeForm[]): Errors {
  const e: Errors = {};
  ticketTypes.forEach((t) => {
    if (!t.name.trim()) e[`${t.id}.name`] = "نام بلیت الزامی است.";
    if (!isNonNegativeInt(t.price)) e[`${t.id}.price`] = "قیمت باید عددی نامنفی باشد.";
    if (!isPositiveInt(t.capacity)) e[`${t.id}.capacity`] = "ظرفیت باید حداقل ۱ باشد.";
    if (!t.salesStartDate) e[`${t.id}.salesStart`] = "شروع فروش الزامی است.";
    if (!t.salesEndDate) e[`${t.id}.salesEnd`] = "پایان فروش الزامی است.";
    if (
      t.salesStartDate &&
      t.salesEndDate &&
      t.salesEndDate < t.salesStartDate
    ) {
      e[`${t.id}.salesEnd`] = "پایان فروش باید بعد از شروع باشد.";
    }
  });
  return e;
}

/** Validate the fields owned by a given step (0-indexed). */
export function validateStep(step: number, state: WizardState): Errors {
  if (step === 0) return validateEventInfo(state.event);
  if (step === 1) return validateSchedule(state);
  return validateTickets(state.ticketTypes);
}
