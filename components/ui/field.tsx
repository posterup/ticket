"use client";

import * as React from "react";
import { FieldError } from "@heroui/react";
import { FieldErrorContext } from "react-aria-components/FieldError";

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
 *
 * **The error is HeroUI's `FieldError`, and it needs a context to exist at
 * all.** React Aria's implementation opens with
 * `if (!validation?.isInvalid) return null` — a bare `<FieldError>{error}</…>`
 * renders *nothing*, which would have silently deleted the validation message
 * from all twenty-one forms that use this component. It reads that state from
 * `FieldErrorContext`, which a React Aria field root (`TextField`,
 * `NumberField`, …) normally provides.
 *
 * `Field` is not one of those: it wraps arbitrary children — our own inputs,
 * `TimeField`, a seat-map picker — and links label to control by `htmlFor`/`id`
 * convention instead. So it supplies the context itself, from the one thing it
 * does know: whether `error` is set. That is also what gives the message
 * `slot="errorMessage"` and the `data-slot="field-error"` hook, so a future
 * conversion of the controls to real field roots can delete this provider and
 * change nothing visible.
 *
 * The context is imported from `react-aria-components` rather than
 * `@heroui/react`, which does not re-export it. That package is now a declared
 * dependency pinned to the version HeroUI already resolves, rather than an
 * undeclared transitive one.
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
  const validation = React.useMemo(
    () => ({
      isInvalid: Boolean(error),
      validationErrors: error ? [error] : [],
      validationDetails: {} as never,
    }),
    [error],
  );

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
      <FieldErrorContext.Provider value={validation}>
        <FieldError id={`${id}-error`} className="text-xs text-danger-text">
          {error}
        </FieldError>
      </FieldErrorContext.Provider>
    </div>
  );
}
