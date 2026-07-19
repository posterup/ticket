import * as React from "react";

import { cn } from "@/lib/utils";

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {
  /** Renders a subtle required marker after the label text. */
  required?: boolean;
}

/** Form label. Always shown above its control (never a placeholder). */
const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, required, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "block text-sm font-medium text-foreground",
        className,
      )}
      {...props}
    >
      {children}
      {required ? (
        <span className="text-danger" aria-hidden>
          {" *"}
        </span>
      ) : null}
    </label>
  ),
);
Label.displayName = "Label";

export { Label };
