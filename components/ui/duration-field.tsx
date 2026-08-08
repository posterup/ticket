"use client";

import { NumberField } from "@heroui/react";
import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

interface DurationFieldProps {
  id?: string;
  /** Length in whole minutes as a digit-only string; `""` when unset. */
  value: string;
  onChange: (minutes: string) => void;
  invalid?: boolean;
}

/**
 * How long a سانس runs, in minutes.
 *
 * The organiser used to set a start clock *and* an end clock — two pickers for
 * one thing they already know as a single number. A workshop is «۹۰ دقیقه»,
 * not «from 18:00 to 19:30». The end is derived; see `addMinutes`.
 *
 * HeroUI's `NumberField` rather than a text input with `inputMode="numeric"`:
 * it brings the −/+ steppers (the common edit is nudging 60 to 90, not retyping
 * it), enforces `minValue={1}` in the control instead of only in `validateDraft`
 * — a zero-length سانس ends the instant it starts — and, being React Aria,
 * parses through the locale pinned in `components/LocaleProvider`, so it takes
 * «۹۰» from a Persian keyboard and `90` from a Latin numpad without the
 * `toAsciiDigits` shim the old text input needed.
 *
 * **No `step`, deliberately.** Quarter-hour steppers were the obvious thing to
 * reach for, and they corrupt the default: React Aria anchors the step grid at
 * `minValue`, so `minValue={1}` with `step={15}` makes the valid values
 * 1, 16, 31, 46, 61 — and the 60 every new سانس starts with was silently
 * rendering as «۶۱». Aligning the grid instead (`minValue={15}`) would fix the
 * display by forbidding any سانس shorter than a quarter of an hour, which is a
 * product decision this control has no business making. Typed values are not
 * snapped, so at `step` 1 nothing the organiser enters is ever rewritten.
 *
 * The digit-string API is unchanged, so `SessionsEditor`, `SessionsManager` and
 * `DateRangeFields` are untouched. The unit lives on the label («مدت (دقیقه)»),
 * not in here — the control is the same whether the form calls it a سانس or a
 * workshop.
 */
export function DurationField({
  id,
  value,
  onChange,
  invalid,
}: DurationFieldProps) {
  const parsed = Number(value);
  return (
    <NumberField
      id={id}
      aria-label="مدت به دقیقه"
      minValue={1}
      isInvalid={invalid}
      // `NaN` is React Aria's "empty", and an empty string parses to 0 — which
      // would silently present a blank field as a zero-minute سانس.
      value={value === "" || !Number.isFinite(parsed) ? Number.NaN : parsed}
      onChange={(n) => onChange(Number.isFinite(n) ? String(n) : "")}
      formatOptions={{ useGrouping: false, maximumFractionDigits: 0 }}
      fullWidth
    >
      <NumberField.Group
        className={cn(
          "h-12 rounded-md border bg-card text-sm tabular-nums",
          invalid ? "border-danger" : "border-field-border",
        )}
      >
        <NumberField.DecrementButton aria-label="کاهش مدت">
          <Minus className="size-4" aria-hidden />
        </NumberField.DecrementButton>
        <NumberField.Input className="text-center" />
        <NumberField.IncrementButton aria-label="افزایش مدت">
          <Plus className="size-4" aria-hidden />
        </NumberField.IncrementButton>
      </NumberField.Group>
    </NumberField>
  );
}
