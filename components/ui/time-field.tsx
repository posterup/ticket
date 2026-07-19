"use client";

import DatePicker, { DateObject } from "react-multi-date-picker";
import TimePicker from "react-multi-date-picker/plugins/time_picker";
import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";

interface TimeFieldProps {
  id?: string;
  /** Stored value as an `HH:mm` string (empty when unset). */
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}

function toDisplayValue(value: string): DateObject | "" {
  if (!value) return "";
  const [hour, minute] = value.split(":").map((n) => Number.parseInt(n, 10));
  return new DateObject().set({
    hour: hour || 0,
    minute: minute || 0,
    second: 0,
  });
}

/** 24-hour time picker (hour/minute), styled to match the other controls. */
export function TimeField({ id, value, onChange, invalid }: TimeFieldProps) {
  return (
    <DatePicker
      disableDayPicker
      format="HH:mm"
      value={toDisplayValue(value)}
      className="poster-cal"
      plugins={[<TimePicker key="tp" hideSeconds />]}
      onChange={(date) => {
        const obj = Array.isArray(date) ? date[0] : date;
        onChange(obj ? obj.format("HH:mm") : "");
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
            {displayValue || "--:--"}
          </span>
          <Clock className="size-4 shrink-0 text-faint" aria-hidden />
        </button>
      )}
    />
  );
}
