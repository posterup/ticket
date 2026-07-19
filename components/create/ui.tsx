"use client";

import { useId, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

/** Three-step progress header for the create flow. */
export function Stepper({
  steps,
  current,
  onStep,
}: {
  steps: string[];
  current: number;
  onStep: (index: number) => void;
}) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => (i <= current ? onStep(i) : undefined)}
              aria-current={active ? "step" : undefined}
              disabled={i > current}
              className={cn(
                "flex min-w-0 items-center gap-2 rounded-md px-1 py-1 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                i > current ? "cursor-default" : "cursor-pointer",
              )}
            >
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : done
                      ? "bg-foreground/10 text-foreground"
                      : "bg-subtle text-faint",
                )}
              >
                {done ? <Check className="size-4" aria-hidden /> : formatNumber(i + 1)}
              </span>
              <span
                className={cn(
                  "truncate text-sm font-medium",
                  active ? "text-foreground" : done ? "text-muted" : "text-faint",
                )}
              >
                {label}
              </span>
            </button>
            {i < steps.length - 1 ? (
              <span
                className={cn(
                  "h-px flex-1",
                  done ? "bg-foreground/30" : "bg-border",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** A titled section card used to structure the composer. */
export function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 text-xs text-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Collapsible "advanced options" region (progressive disclosure). */
export function Disclosure({
  label,
  children,
  defaultOpen = false,
  onOpenChange,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      onOpenChange?.(next);
      return next;
    });
  };
  return (
    <div className="border-t border-border pt-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center justify-between gap-2 text-sm font-medium text-muted hover:text-foreground"
      >
        {label}
        <ChevronDown
          className={cn("size-4 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <div id={id} className="mt-4 flex flex-col gap-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Compact switch used for boolean options. */
export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <span className="text-sm text-foreground">{label}</span>
        {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
          checked ? "bg-foreground" : "bg-border",
        )}
      >
        <span
          className={cn(
            // Logical start inset + direction-aware transform so the knob
            // travels correctly under both dir=rtl and dir=ltr.
            "absolute top-0.5 start-0.5 size-5 rounded-full bg-background shadow-sm transition-transform",
            checked ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}
