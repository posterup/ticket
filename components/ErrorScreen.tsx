"use client";

/**
 * The shape every dead end shares.
 *
 * There were three of these — `error.tsx`, `not-found.tsx`, and now the 500
 * screen — each hand-building the same centred column of icon, heading,
 * paragraph and two buttons. Three copies of one layout is how they drift:
 * a different radius here, a different gap there, and a product that looks
 * least composed at exactly the moment a reader is deciding whether it works.
 *
 * The status code is a small legible chip, not the giant background numeral
 * every error page reaches for. That was built and cut: this product ships
 * mobile-only (`DesktopGate`), and at 390px there is no margin for a decorative
 * glyph — it either gets sheared by `overflow-hidden` or sits directly behind
 * the paragraph a worried reader is trying to read. As a chip the same digits
 * cost two lines of layout, survive every width, and actually tell someone what
 * to quote when they ask for help.
 *
 * Deliberately *not* `global-error.tsx`, which stays hand-rolled with inline
 * styles: that one catches the root layout failing, so it cannot import a
 * component, a token, or a stylesheet without depending on the thing that just
 * broke.
 */

import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";

export type ErrorTone = "danger" | "neutral";

const TONES: Record<ErrorTone, { chip: string; code: string }> = {
  danger: {
    chip: "bg-danger/10 text-danger-text",
    code: "border-danger/20 text-danger-text",
  },
  neutral: {
    chip: "bg-subtle text-muted",
    code: "border-border text-faint",
  },
};

export function ErrorScreen({
  icon: Icon,
  code,
  tone = "neutral",
  title,
  description,
  note,
  actions,
  footnote,
}: {
  icon: LucideIcon;
  /** Status code shown as a chip — «۵۰۰», «۴۰۴». Omit when there is none. */
  code?: string;
  tone?: ErrorTone;
  title: string;
  description: string;
  /** Reassurance below the explanation — what is *not* lost. */
  note?: string;
  actions: React.ReactNode;
  /** Trace id, or anything else a person can quote to support. */
  footnote?: React.ReactNode;
}) {
  const still = useReducedMotion();
  const tint = TONES[tone];

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
      <motion.div
        initial={still ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
        className="flex flex-col items-center"
      >
        <span
          className={cn(
            "mb-5 grid size-14 place-items-center rounded-full",
            tint.chip,
          )}
        >
          <Icon className="size-7" aria-hidden />
        </span>

        <h1 className="text-balance text-xl font-bold text-foreground sm:text-2xl">
          {title}
        </h1>

        {code ? (
          <span
            className={cn(
              "mt-3 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tabular-nums",
              tint.code,
            )}
          >
            {`خطای ${code}`}
          </span>
        ) : null}

        <p className="mx-auto mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted">
          {description}
        </p>

        {note ? (
          <p className="mx-auto mt-3 max-w-sm text-pretty text-xs leading-relaxed text-faint">
            {note}
          </p>
        ) : null}

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          {actions}
        </div>

        {footnote ? <div className="mt-6">{footnote}</div> : null}
      </motion.div>
    </main>
  );
}
