import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type SelectProps =
  React.SelectHTMLAttributes<HTMLSelectElement>;

/** Native select styled to match the Input primitive, with an RTL-aware chevron. */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "h-12 w-full appearance-none rounded-md border border-border bg-card ps-3.5 pe-10 text-sm text-foreground",
          "outline-none transition-colors",
          "hover:border-border-strong focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring/15",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute inset-y-0 left-3.5 my-auto size-4 text-faint"
        aria-hidden
      />
    </div>
  ),
);
Select.displayName = "Select";

export { Select };
