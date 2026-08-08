"use client";

import * as React from "react";
import { Input as HeroInput } from "@heroui/react";

import { cn } from "@/lib/utils";

export type InputProps = React.ComponentPropsWithRef<typeof HeroInput>;

/**
 * Text input primitive.
 *
 * HeroUI's `Input` is React Aria's `Input` — a real `<input>` that picks up
 * focus/hover/invalid state from whatever React Aria field context it sits in,
 * and falls back to behaving like a plain input when there is none. That is why
 * this swap is transparent: native `value` / `onChange={e => …}` still work, so
 * none of the twenty call sites changed. The old comment here claimed HeroUI
 * would make controlled typing unreliable; that is true of the *composed*
 * `TextField`, not of this primitive.
 *
 * The brand classes stay explicit rather than leaning on HeroUI's variants,
 * because the 48px height and hairline `--field-border` are ours and are shared
 * with `TimeField` and `NumberField`, which are differently-shaped components.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <HeroInput
      ref={ref}
      type={type}
      className={cn(
        "h-12 w-full rounded-md border border-field-border bg-card px-3.5 text-sm text-foreground",
        "outline-none transition-colors placeholder:text-faint",
        "hover:border-foreground/50 focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring/15",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
