import { cn } from "@/lib/utils";

/** Visual accent for the badge pill, mapped to a semantic design token. */
export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

const TONES: Record<BadgeTone, string> = {
  neutral: "border-border bg-subtle text-muted",
  accent: "border-transparent bg-accent-soft text-accent",
  success: "border-transparent bg-success/10 text-success",
  warning: "border-transparent bg-warning/10 text-warning",
  danger: "border-transparent bg-danger/10 text-danger",
};

/**
 * Purchase box on the public event page. Renders a single sales state:
 * an optional badge at the top, a title + optional subtitle on the (RTL) start
 * side, and the action control (button/link) pinned to the end side.
 *
 * Presentational only — the caller resolves which state to show and supplies
 * the `action` node so client-interactive controls (notify me, waitlist) can be
 * slotted in without making this a client component.
 */
export function BuyBox({
  badge,
  title,
  original,
  subtitle,
  action,
  className,
}: {
  badge?: { label: string; tone: BadgeTone };
  title: string;
  /** When set, shown struck-through before `title` — `title` is the deal price. */
  original?: string;
  subtitle?: string;
  action: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-border bg-card p-5 shadow-lg",
        className,
      )}
    >
      {/* Badge — a tab straddling the top edge */}
      {badge ? (
        <span
          className={cn(
            "absolute top-0 start-4 inline-flex -translate-y-1/2 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium shadow-sm",
            TONES[badge.tone],
          )}
        >
          {badge.label}
        </span>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        {/* Title + subtitle — start (right in RTL) */}
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            {original ? (
              <span className="text-sm text-faint line-through">{original}</span>
            ) : null}
            <p
              className={cn(
                "truncate text-base font-bold",
                original ? "text-accent" : "text-foreground",
              )}
            >
              {title}
            </p>
          </div>
          {subtitle ? (
            <p className="mt-0.5 text-xs leading-5 text-muted">{subtitle}</p>
          ) : null}
        </div>

        {/* Action — end (left in RTL) */}
        <div className="shrink-0">{action}</div>
      </div>
    </div>
  );
}
