"use client";

import { Input, type InputProps } from "@/components/ui/input";
import { toAsciiDigits } from "@/lib/format";

type DurationFieldProps = Omit<
  InputProps,
  "value" | "onChange" | "type" | "inputMode"
> & {
  /** Length in whole minutes as a digit-only string; `""` when unset. */
  value: string;
  onChange: (minutes: string) => void;
};

/**
 * How long a سانس runs, in minutes.
 *
 * The organiser used to set a start clock *and* an end clock — two pickers for
 * one thing they already know as a single number. A workshop is «۹۰ دقیقه»,
 * not «from 18:00 to 19:30». The end is derived; see `addMinutes`.
 *
 * A text input with `inputMode="numeric"` rather than `type="number"`: the
 * spinner is dead weight at this size on a phone, and a number input drops the
 * Persian digits an Iranian keyboard produces instead of accepting them.
 * `toAsciiDigits` takes Persian, Arabic or Latin and emits digits ready for
 * `Number(...)`, matching what `MoneyInput` does with a price.
 *
 * The unit belongs on the label («مدت (دقیقه)»), not in here — the field is the
 * same control whether the surrounding form calls it a سانس or a workshop.
 */
export function DurationField({ value, onChange, ...props }: DurationFieldProps) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      dir="ltr"
      placeholder="90"
      value={value}
      onChange={(e) => onChange(toAsciiDigits(e.target.value).replace(/\D/g, ""))}
      {...props}
    />
  );
}
