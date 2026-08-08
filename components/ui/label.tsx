"use client";

import * as React from "react";
import { Label as HeroLabel } from "@heroui/react";

import { cn } from "@/lib/utils";

export interface LabelProps
  extends React.ComponentPropsWithRef<typeof HeroLabel> {
  /** Renders a subtle required marker after the label text. */
  required?: boolean;
}

/**
 * Form label. Always shown above its control (never a placeholder).
 *
 * HeroUI's `Label` renders React Aria's, which links to its control through
 * *field context* when there is one. `Field` has no such context — it wires
 * label to control by `htmlFor`/`id` convention around arbitrary children — so
 * `htmlFor` is still passed through and is still what does the linking here.
 * Both mechanisms coexist: React Aria falls back to a plain `<label>`.
 *
 * `required` stays a native-style boolean rather than HeroUI's `isRequired`,
 * because the marker is ours: `isRequired` styles the label, but the «*» glyph
 * and its `--danger-text` colour are a brand decision.
 */
const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, required, ...props }, ref) => (
    <HeroLabel
      ref={ref}
      className={cn("block text-sm font-medium text-foreground", className)}
      {...props}
    >
      {children}
      {required ? (
        <span className="text-danger-text" aria-hidden>
          {" *"}
        </span>
      ) : null}
    </HeroLabel>
  ),
);
Label.displayName = "Label";

export { Label };
