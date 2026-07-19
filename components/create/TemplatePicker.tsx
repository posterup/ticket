"use client";

import { Check, PencilLine } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  COMPOSER_TEMPLATES,
  type ComposerTemplate,
} from "@/lib/create/templates";

/**
 * Quick-start gallery at the top of the composer. Selecting a template seeds
 * the draft with sensible defaults the organizer then edits; "شروع از صفر"
 * clears back to a blank draft.
 */
export function TemplatePicker({
  selected,
  onSelect,
  onBlank,
}: {
  selected: string | null;
  onSelect: (template: ComposerTemplate) => void;
  onBlank: () => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-subtle p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            شروع سریع با قالب
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            یک قالب را انتخاب کنید تا زمان‌بندی و بلیت‌ها پیش‌فرض پر شوند.
          </p>
        </div>
        <button
          type="button"
          onClick={onBlank}
          aria-pressed={selected === null}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/15",
            selected === null
              ? "border-foreground bg-card text-foreground"
              : "border-border text-muted hover:border-border-strong",
          )}
        >
          <PencilLine className="size-3.5" aria-hidden />
          شروع از صفر
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {COMPOSER_TEMPLATES.map((t) => {
          const active = selected === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t)}
              aria-pressed={active}
              className={cn(
                "flex flex-col items-start gap-2 rounded-lg border bg-card p-4 text-start outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/15",
                active
                  ? "border-foreground ring-1 ring-foreground"
                  : "border-border hover:border-border-strong",
              )}
            >
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-md",
                  active ? "bg-foreground text-background" : "bg-subtle text-foreground",
                )}
              >
                {active ? (
                  <Check className="size-5" aria-hidden />
                ) : (
                  <t.icon className="size-5" aria-hidden />
                )}
              </span>
              <span className="text-sm font-semibold text-foreground">{t.name}</span>
              <span className="text-xs leading-relaxed text-muted">{t.tagline}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
