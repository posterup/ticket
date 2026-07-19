"use client";

import DatePicker, { DateObject } from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import gregorian from "react-date-object/calendars/gregorian";
import persian_fa from "react-date-object/locales/persian_fa";
import gregorian_en from "react-date-object/locales/gregorian_en";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface DateFieldProps {
  id?: string;
  /** Stored value as a Gregorian `YYYY-MM-DD` string (empty when unset). */
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}

/** Convert the stored Gregorian date into a Persian-calendar DateObject. */
function toDisplayValue(value: string): DateObject | "" {
  if (!value) return "";
  return new DateObject({
    date: value,
    format: "YYYY-MM-DD",
    calendar: gregorian,
    locale: gregorian_en,
  }).convert(persian, persian_fa);
}

/**
 * Jalali (Shamsi) date picker. Users pick in the Persian calendar; the value
 * is stored as a Gregorian ISO date so the API contract stays unchanged.
 */
export function DateField({ id, value, onChange, invalid }: DateFieldProps) {
  return (
    <DatePicker
      value={toDisplayValue(value)}
      calendar={persian}
      locale={persian_fa}
      calendarPosition="bottom-right"
      className="poster-cal"
      editable={false}
      onChange={(date) => {
        const obj = Array.isArray(date) ? date[0] : date;
        onChange(
          obj ? obj.convert(gregorian, gregorian_en).format("YYYY-MM-DD") : "",
        );
      }}
      render={(displayValue, openCalendar) => (
        <button
          id={id}
          type="button"
          onClick={openCalendar}
          aria-invalid={invalid}
          className={cn(
            "flex h-12 w-full items-center justify-between gap-2 rounded-md border bg-card px-3.5 text-start text-sm outline-none transition-colors",
            "hover:border-border-strong focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring/15",
            invalid ? "border-danger" : "border-border",
          )}
        >
          <span className={displayValue ? "text-foreground" : "text-faint"}>
            {displayValue || "انتخاب تاریخ"}
          </span>
          <CalendarIcon className="size-4 shrink-0 text-faint" aria-hidden />
        </button>
      )}
    />
  );
}
