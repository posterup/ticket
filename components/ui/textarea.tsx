"use client";

import * as React from "react";
import { TextArea } from "@heroui/react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.ComponentPropsWithRef<typeof TextArea>;

/**
 * Multi-line text input primitive.
 *
 * HeroUI's `TextArea`, which is React Aria's `TextArea` primitive — a real
 * `<textarea>`, so native `value` / `onChange` are unchanged and all five call
 * sites are untouched. See `input.tsx` for why the brand classes stay explicit.
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 4, ...props }, ref) => (
    <TextArea
      ref={ref}
      rows={rows}
      className={cn(
        "w-full rounded-md border border-field-border bg-card px-3.5 py-3 text-sm text-foreground",
        "outline-none transition-colors placeholder:text-faint",
        "hover:border-foreground/50 focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring/15",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
