"use client";

import { Clock } from "lucide-react";
import { Calendar, DateObject } from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import gregorian from "react-date-object/calendars/gregorian";
import persian_fa from "react-date-object/locales/persian_fa";
import gregorian_en from "react-date-object/locales/gregorian_en";

import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { TimeField } from "@/components/ui/time-field";

export interface DateRange {
  /** Gregorian `YYYY-MM-DD`. */
  startDate: string;
  endDate: string;
  /** `HH:mm`. */
  startTime: string;
  endTime: string;
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
          invalid ? "text-danger" : "text-muted",
        )}
      >
        {days > 0
          ? `${formatNumber(days)} روز انتخاب شده`
          : "روز شروع و روز پایان را روی تقویم انتخاب کنید."}
      </p>

      {/* One hour range, shared by every day — a single clean row. */}
      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Clock className="size-4 text-faint" aria-hidden />
          ساعت برگزاری
        </span>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <TimeField
              id="range-start-time"
              value={value.startTime}
              onChange={(startTime) => onChange({ ...value, startTime })}
            />
          </div>
          <span className="shrink-0 text-sm text-muted">تا</span>
          <div className="flex-1">
            <TimeField
              id="range-end-time"
              value={value.endTime}
              onChange={(endTime) => onChange({ ...value, endTime })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
