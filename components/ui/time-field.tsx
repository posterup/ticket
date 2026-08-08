"use client";

import { TimeField as HeroTimeField } from "@heroui/react";
import { Time } from "@internationalized/date";

import { cn } from "@/lib/utils";

interface TimeFieldProps {
  id?: string;
  /** Stored value as an `HH:mm` string (empty when unset). */
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}

/** `"18:30"` → a React Aria `Time`, or `null` while the field is empty. */
function toTime(value: string): Time | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return new Time(hour, minute);
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 24-hour time entry, as two typeable segments.
 *
 * **Why this is not a popover.** It was one: a `react-multi-date-picker`
 * time-picker plugin behind a button, whose only affordance was a stacked pair
 * of ˄/˅ arrows. There was no way to *type* a time, so setting 18:30 from a
 * default of 10:50 cost twenty-eight clicks on ~20px targets — on a product
 * that is mobile-first. HeroUI's `TimeField` is React Aria's segmented field:
 * type `1830` straight through, arrow keys adjust the focused segment, and the
 * value is legible without opening anything, which matters in a form that
 * stacks one of these per سانس.
 *
 * **The clock format comes from locale**, pinned in
 * `components/LocaleProvider.tsx` — React Aria reads the browser's locale, not
 * `<html lang="fa">`, so without that provider this renders `6:30 PM` for a
 * reader whose Chrome is English. `hourCycle` is still passed explicitly: the
 * locale happens to imply 24-hour today, and a سانس list where one row reads
 * «۱۸:۳۰» and another «۶:۳۰ ب.ظ» is not a thing to leave to a CLDR default.
 *
 * Digits here are **Latin**, and that is the one place this product is not
 * Persian-first. Under Persian numbering these segments accept only `۰-۹`, so
 * a Latin numpad typed into them does nothing and says nothing. Displayed
 * times — chips, the preview — go through `formatClock` and stay Persian; see
 * `LocaleProvider` for the full reasoning.
 *
 * The `HH:mm` string API is unchanged from the old component, so every call
 * site — `SessionsEditor`, `SessionsManager`, `DateRangeFields` — is untouched.
 */
export function TimeField({ id, value, onChange, invalid }: TimeFieldProps) {
  return (
    <HeroTimeField
      id={id}
      aria-label="ساعت"
      hourCycle={24}
      granularity="minute"
      isInvalid={invalid}
      value={toTime(value)}
      onChange={(time) =>
        onChange(time ? `${pad(time.hour)}:${pad(time.minute)}` : "")
      }
      fullWidth
    >
      {/* `dir="ltr"`: a clock reads hour-then-minute in every locale, including
          this one. Left to the document's `rtl` the segments swap and 18:30
          renders as 30:18. */}
      <HeroTimeField.Group
        dir="ltr"
        className={cn(
          "h-12 rounded-md border bg-card px-3.5 text-sm tabular-nums",
          invalid ? "border-danger" : "border-field-border",
        )}
      >
        <HeroTimeField.Input>
          {(segment) => <HeroTimeField.Segment segment={segment} />}
        </HeroTimeField.Input>
      </HeroTimeField.Group>
    </HeroTimeField>
  );
}
