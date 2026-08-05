import * as React from "react";

import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Text input primitive — a native <input> styled with the brand tokens (48px
 * tall, 12px radius, hairline border). Kept native (not HeroUI's React-Aria
 * Input) so controlled `value`/`onChange` typing stays instant and reliable.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <input
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
