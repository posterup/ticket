import { cn } from "@/lib/utils";

interface BarChartProps {
  data: { label: string; value: number }[];
  /** Formats a value for the per-bar tooltip (e.g. Toman). */
  formatValue: (value: number) => string;
  ariaLabel: string;
}

/** Minimal monochrome vertical bar chart (single series). */
export function BarChart({ data, formatValue, ariaLabel }: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const peak = data.reduce((m, d) => (d.value > m.value ? d : m), data[0]);

  return (
    <figure role="img" aria-label={ariaLabel}>
      {/* Fixed-height row so each bar's percentage height resolves. */}
      <div className="flex h-44 items-end gap-2 sm:gap-3">
        {data.map((d) => (
          <div
            key={d.label}
            title={`${d.label}: ${formatValue(d.value)}`}
            style={{ height: `${Math.max(3, (d.value / max) * 100)}%` }}
            className={cn(
              "flex-1 rounded-t-md transition-colors",
              d.label === peak.label ? "bg-foreground" : "bg-foreground/15",
            )}
          />
        ))}
      </div>
      <div className="mt-2 flex gap-2 sm:gap-3">
        {data.map((d) => (
          <span
            key={d.label}
            className="flex-1 text-center text-[0.6875rem] text-faint"
          >
            {d.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
