"use client";

import * as React from "react";
import { Input as HeroInput } from "@heroui/react";

import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Text input — HeroUI's <Input> (React Aria), themed by the brand tokens. It
 * wraps a real <input>, so the native `value`/`onChange(event)`/`type` API is
 * unchanged and every existing call site keeps working.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <HeroInput ref={ref} type={type} className={cn(className)} {...props} />
  ),
);
Input.displayName = "Input";

export { Input };
