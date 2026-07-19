import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

interface WizardStepperProps {
  steps: string[];
  /** 0-indexed current step. */
  current: number;
}

/** Compact 3-step progress indicator (numbers + titles + connectors). */
export function WizardStepper({ steps, current }: WizardStepperProps) {
  return (
    <ol className="flex items-center gap-2" aria-label="مراحل ساخت بلیت">
      {steps.map((title, i) => {
        const isDone = i < current;
        const isActive = i === current;
        return (
          <li key={title} className="flex flex-1 items-center gap-2">
            <div className="flex items-center gap-2.5">
              <span
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full border text-sm font-semibold transition-colors",
                  isActive &&
                    "border-foreground bg-foreground text-background",
                  isDone && "border-foreground bg-foreground text-background",
                  !isActive &&
                    !isDone &&
                    "border-border bg-card text-faint",
                )}
              >
                {isDone ? (
                  <Check className="size-4" aria-hidden />
                ) : (
                  <span>{i + 1}</span>
                )}
              </span>
              <span
                className={cn(
                  "hidden text-sm font-medium sm:block",
                  isActive || isDone ? "text-foreground" : "text-faint",
                )}
              >
                {title}
              </span>
            </div>
            {i < steps.length - 1 ? (
              <span
                className={cn(
                  "h-px flex-1",
                  i < current ? "bg-foreground" : "bg-border",
                )}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
