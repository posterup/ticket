"use client";

import { Clock } from "lucide-react";
import { Calendar, DateObject } from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import gregorian from "react-date-object/calendars/gregorian";
import persian_fa from "react-date-object/locales/persian_fa";
import gregorian_en from "react-date-object/locales/gregorian_en";

import { cn } from "@/lib/utils";
import { addMinutes, formatClock, formatNumber } from "@/lib/format";
import { TimeField } from "@/components/ui/time-field";
import { DurationField } from "@/components/ui/duration-field";

export interface DateRange {
  /** Gregorian `YYYY-MM-DD`. */
  startDate: string;
  endDate: string;
  /** `HH:mm`. */
  startTime: string;
  /** Length in whole minutes, as a digit-only string. */
  durationMin: string;
}

/** Gregorian `YYYY-MM-DD` → a Persian-calendar DateObject for the picker value. */
function toPersian(value: string): DateObject | null {
  if (!value) return null;
  return new DateObject({
    date: value,
    format: "YYYY-MM-DD",
    calendar: gregorian,
    locale: gregorian_en,
  }).convert(persian, persian_fa);
}

/** A picker DateObject → stored Gregorian `YYYY-MM-DD`. */
function toGregorian(obj: DateObject): string {
  return obj.convert(gregorian, gregorian_en).format("YYYY-MM-DD");
}

/** Whole days spanned by an inclusive `[start, end]` Gregorian range. */
function dayCount(startDate: string, endDate: string): number {
  if (!startDate) return 0;
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate || startDate}T00:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.round((end - start) / 86_400_000) + 1;
}

/**
 * Inline picker for a multi-day event's whole run: a full-width Jalali calendar
 * in range mode for the date span, plus a start/end hour range shared by every
 * day. No surrounding boxes — the calendar sits flush. Edits apply live through
 * {@link onChange}.
 */
export function DateRangeFields({
  value,
  invalid,
  onChange,
}: {
  value: DateRange;
  invalid?: boolean;
  onChange: (range: DateRange) => void;
}) {
  const rangeValue = [toPersian(value.startDate), toPersian(value.endDate)].filter(
    Boolean,
  ) as DateObject[];

  function handleCalendarChange(dates: DateObject | DateObject[] | null) {
    const arr = Array.isArray(dates) ? dates : dates ? [dates] : [];
    const [start, end] = arr;
    // Keep `endDate` empty after the first click so the range stays open — the
    // next click sets the end. Collapsing it to the start would look like a
    // finished 1-day range and restart selection instead of extending it.
    onChange({
      ...value,
      startDate: start ? toGregorian(start) : "",
      endDate: end ? toGregorian(end) : "",
    });
  }

  const days = dayCount(value.startDate, value.endDate);
  const minutes = Number(value.durationMin);
  const endsAt =
    value.startTime && Number.isFinite(minutes) && minutes > 0
      ? addMinutes(value.startTime, minutes)
      : "";

  return (
    <div className="flex flex-col gap-5">
      {/* Full-width Jalali range calendar — no box, sits flush. */}
      <Calendar
        range
        calendar={persian}
        locale={persian_fa}
        value={rangeValue}
        onChange={handleCalendarChange}
        className="poster-cal poster-cal-full"
      />

      <p
        className={cn(
          "text-center text-xs",
          invalid ? "text-danger-text" : "text-muted",
        )}
      >
        {days > 0
          ? `${formatNumber(days)} روز انتخاب شده`
          : "روز شروع و روز پایان را روی تقویم انتخاب کنید."}
      </p>

      {/*
        One start time and one length, shared by every day in the range.

        These were two bare `<input type="time">` — the only hand-rolled time
        entry left in the codebase, and it showed: the native control renders a
        different widget in every browser, ignores the Jalali calendar the row
        above it uses, and was styled by copying `TimeField`'s classes rather
        than being it. Now it *is* `TimeField`, so a fix to the picker reaches
        every سانس in the product at once.
      */}
      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Clock className="size-4 text-faint" aria-hidden />
          ساعت برگزاری
        </span>
        <div className="grid grid-cols-2 gap-3">
          <label htmlFor="range-start-time" className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">ساعت شروع</span>
            <TimeField
              id="range-start-time"
              value={value.startTime}
              onChange={(startTime) => onChange({ ...value, startTime })}
            />
          </label>
          <label htmlFor="range-duration" className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">مدت (دقیقه)</span>
            <DurationField
              id="range-duration"
              value={value.durationMin}
              onChange={(durationMin) => onChange({ ...value, durationMin })}
            />
          </label>
        </div>
        {endsAt ? (
          /* The derived end, stated rather than typed — an organiser setting a
             length still wants to see the clock time it lands on, especially
             the late show that lands on tomorrow's. */
          <p className="text-xs text-muted">
            پایان هر روز: {formatClock(endsAt)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
