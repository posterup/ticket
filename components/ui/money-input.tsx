"use client";

import { Input, type InputProps } from "@/components/ui/input";
import { toAsciiDigits } from "@/lib/format";

/** Group an all-digit string with thousands separators, e.g. `50000` → `50,000`. */
function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

type MoneyInputProps = Omit<
  InputProps,
  "value" | "onChange" | "type" | "inputMode"
> & {
  /** Raw integer amount as a digit-only string (e.g. `"50000"`); `""` when empty. */
  value: string;
  /** Called with the digit-only value (no separators), ready for `Number(...)`. */
  onChange: (raw: string) => void;
};

/**
 * Toman amount input: shows thousands grouping while the user types and emits a
 * digit-only string. Accepts Persian, Arabic, or Latin digits.
 */
export function MoneyInput({ value, onChange, ...props }: MoneyInputProps) {
  const digits = toAsciiDigits(value).replace(/\D/g, "");
  return (
    <Input
      type="text"
      inputMode="numeric"
      dir="ltr"
      value={group(digits)}
      onChange={(e) => onChange(toAsciiDigits(e.target.value).replace(/\D/g, ""))}
      {...props}
    />
  );
}
