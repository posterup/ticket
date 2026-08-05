"use client";

/**
 * "How many, and let us pick."
 *
 * The highest-converting path through a seat map is the one that skips it. Most
 * buyers want N seats together at a price and have no opinion beyond that;
 * making them learn a venue's geography first is a tax on the majority to serve
 * the minority who care.
 *
 * So this sits at the top of the picker column and asks the only two questions
 * that matter — how many, and what will you pay — while the map underneath
 * stays available for anyone who does want to choose.
 *
 * It is offered only when nothing is selected yet. Once someone has taken seats
 * of their own, handing them a button that silently swaps those seats for the
 * server's guess would throw away work they have already done.
 */

import { useState } from "react";
import { Accessibility, Sparkles } from "lucide-react";

import { apiFetch, ApiCallError } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { formatNumber, formatToman } from "@/lib/format";
import { Button } from "@/components/ui/button";

export interface BestAvailableResult {
  sessionId: string;
  section: string;
  sectionName: string;
  seats: number[];
  rowLabel: string;
  seatLabels: string[];
  unitPrice?: number;
  expiresAt: string;
}

interface Props {
  sessionId: string;
  /** Cheapest seat in the house, for the budget hint. */
  priceFrom?: number;
  /** Dearest, so the budget control has a sensible top end. */
  priceTo?: number;
  maxQuantity: number;
  onFound: (result: BestAvailableResult) => void;
}

export function BestAvailable({
  sessionId,
  priceFrom,
  priceTo,
  maxQuantity,
  onFound,
}: Props) {
  const [quantity, setQuantity] = useState(2);
  const [accessible, setAccessible] = useState(false);
  const [budget, setBudget] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const find = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<BestAvailableResult>(
        `/api/sessions/${sessionId}/best-available`,
        {
          method: "POST",
          body: JSON.stringify({
            quantity,
            ...(accessible ? { accessible: true } : {}),
            ...(budget ? { maxPrice: budget } : {}),
          }),
        },
      );
      onFound(result);
    } catch (e) {
      setError(
        e instanceof ApiCallError ? e.message : "پیدا کردن صندلی ممکن نشد.",
      );
    } finally {
      setBusy(false);
    }
  };

  // Only worth showing when the house actually spans more than one price.
  const budgets =
    priceFrom !== undefined && priceTo !== undefined && priceTo > priceFrom
      ? [priceFrom, Math.round((priceFrom + priceTo) / 2), priceTo]
      : [];

  return (
    // The brand is light-on-light by design, so a tinted fill cannot carry
    // identity: accent-soft is 1.15:1 against the page. The border is what
    // makes this read as the primary path, which is why it is a real accent
    // line and not the 30%-opacity hint that measured 1.63:1 and vanished.
    <div className="rounded-xl border border-accent/60 bg-accent-soft p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
        <Sparkles className="size-4 text-accent-text" aria-hidden />
        بهترین صندلی را برایم پیدا کن
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        تعداد را بگویید تا نزدیک‌ترین صندلی‌های کنار هم را انتخاب کنیم. اگر
        دوست دارید خودتان انتخاب کنید، از نقشه استفاده کنید.
      </p>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-sm text-foreground">تعداد صندلی</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="کاهش تعداد"
            disabled={quantity <= 1}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="grid size-11 place-items-center rounded-lg border border-field-border bg-card text-lg text-foreground outline-none transition-colors hover:border-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          >
            −
          </button>
          <span
            aria-live="polite"
            className="min-w-10 text-center text-base font-bold tabular-nums text-foreground"
          >
            {formatNumber(quantity)}
          </span>
          <button
            type="button"
            aria-label="افزایش تعداد"
            disabled={quantity >= maxQuantity}
            onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
            className="grid size-11 place-items-center rounded-lg border border-field-border bg-card text-lg text-foreground outline-none transition-colors hover:border-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      {budgets.length ? (
        <fieldset className="mt-4">
          <legend className="text-xs text-muted">حداکثر قیمت هر صندلی</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <BudgetChip
              active={budget === null}
              onClick={() => setBudget(null)}
            >
              فرقی ندارد
            </BudgetChip>
            {budgets.map((value) => (
              <BudgetChip
                key={value}
                active={budget === value}
                onClick={() => setBudget(value)}
              >
                تا {formatToman(value)}
              </BudgetChip>
            ))}
          </div>
        </fieldset>
      ) : null}

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-foreground">
        <input
          type="checkbox"
          checked={accessible}
          onChange={(e) => setAccessible(e.target.checked)}
          className="size-4 accent-[var(--accent)]"
        />
        <Accessibility className="size-4 text-muted" aria-hidden />
        فقط جایگاه ویلچر و همراه
      </label>

      <Button
        className="mt-4 w-full"
        disabled={busy}
        onClick={find}
      >
        {busy ? "در حال جست‌وجو…" : "پیدا کن و نگه دار"}
      </Button>

      {error ? (
        <p
          role="status"
          className="mt-2 rounded-lg bg-card px-3 py-2 text-xs text-danger-text"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function BudgetChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-accent bg-accent text-accent-foreground"
          : "border-field-border bg-card text-muted hover:border-accent",
      )}
    >
      {children}
    </button>
  );
}
