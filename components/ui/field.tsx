import * as React from "react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface FieldProps {
  /** Stable id linking the label to its control and the error message. */
  id: string;
  label: string;
  required?: boolean;
  /** Optional helper text shown below the label. */
  hint?: string;
  /** Validation message; when present the control should be marked invalid. */
  error?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Field layout: label on top, control, then hint/error below (never a
 * placeholder-as-label). Wires aria-describedby via a predictable id scheme.
 */
export function Field({
  id,
  label,
  required,
  hint,
  error,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-faint">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
