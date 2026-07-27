"use client";

import * as React from "react";
import { TextArea as HeroTextArea } from "@heroui/react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * Multi-line text input — HeroUI's <TextArea> (React Aria), themed by the brand
 * tokens. Wraps a real <textarea>, so the native `value`/`onChange(event)`/`rows`
 * API is unchanged.
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 4, ...props }, ref) => (
    <HeroTextArea ref={ref} rows={rows} className={cn(className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
