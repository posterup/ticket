"use client";

/**
 * The accessible seat picker.
 *
 * A canvas is invisible to assistive technology, and ticketing is one of the
 * places that gets tested for it. This is the real control surface: a grouped
 * listbox of every seat in the open section, keyboard-navigable, announcing
 * row, number, state and price. The canvas beside it is the *visual* affordance
 * for people who want one.
 *
 * It is not a fallback hidden behind a media query — it is always in the tree
 * and always in sync, because a picker that only some people can operate is a
 * picker that breaks silently.
 */

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { faDigits, formatNumber, formatToman } from "@/lib/format";
import type { Money, SectionSeats, SeatKind } from "@/types";
import { SEAT_KINDS } from "@/types";

const KIND_LABEL: Record<SeatKind, string> = {
  standard: "",
  wheelchair: "ویژه ویلچر",
  companion: "همراه",
  obstructed: "دید محدود",
  house: "رزرو سالن",
};

interface Props {
  seats: SectionSeats;
  sectionName: string;
  sold: Set<number>;
  held: Set<number>;
  selected: Set<number>;
  onToggle: (index: number) => void;
  price?: Money;
  /** Show only seats usable by a wheelchair user and their companion. */
  accessibleOnly?: boolean;
  onAccessibleOnlyChange?: (next: boolean) => void;
}

export function SeatList({
  seats,
  sectionName,
  sold,
  held,
  selected,
  onToggle,
  price,
  accessibleOnly = false,
  onAccessibleOnlyChange,
}: Props) {
  const [openRow, setOpenRow] = useState<string | null>(
    seats.rows[0]?.key ?? null,
  );

  const hasAccessible = useMemo(
    () =>
      seats.kind.some(
        (k) => SEAT_KINDS[k] === "wheelchair" || SEAT_KINDS[k] === "companion",
      ),
    [seats],
  );

  const rows = useMemo(
    () =>
      seats.rows
        .map((row) => {
          const indices: number[] = [];
          for (let i = row.from; i < row.from + row.count; i += 1) {
            const kind = SEAT_KINDS[seats.kind[i]] ?? "standard";
            if (
              accessibleOnly &&
              kind !== "wheelchair" &&
              kind !== "companion"
            ) {
              continue;
            }
            indices.push(i);
          }
          const free = indices.filter(
            (i) => !sold.has(i) && !held.has(i),
          ).length;
          return { ...row, indices, free };
        })
        .filter((row) => row.indices.length > 0),
    [seats, sold, held, accessibleOnly],
  );

  return (
    /* `min-h-0 flex-1`, not `h-full` — see the card in `SeatMap`. A percentage
       height needs a definite parent height; being a flex child that may shrink
       does not. */
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <h3 className="text-sm font-bold text-foreground">
          انتخاب صندلی — {sectionName}
        </h3>
        {hasAccessible && onAccessibleOnlyChange ? (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={accessibleOnly}
              onChange={(e) => onAccessibleOnlyChange(e.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            فقط صندلی‌های دسترس‌پذیر
          </label>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            صندلی‌ای با این فیلتر پیدا نشد.
          </p>
        ) : null}

        {rows.map((row) => {
          const expanded = openRow === row.key;
          return (
            <div key={row.key} className="border-b border-border/60 last:border-0">
              <button
                type="button"
                onClick={() => setOpenRow(expanded ? null : row.key)}
                aria-expanded={expanded}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2.5 text-start outline-none transition-colors hover:bg-subtle focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="text-sm font-medium text-foreground">
                  ردیف {faDigits(row.label)}
                </span>
                <span className="text-xs text-muted">
                  {row.free > 0
                    ? `${formatNumber(row.free)} جای خالی`
                    : "تکمیل"}
                </span>
              </button>

              {expanded ? (
                <ul
                  role="listbox"
                  aria-label={`صندلی‌های ردیف ${faDigits(row.label)}`}
                  aria-multiselectable
                  className="flex flex-wrap gap-1.5 px-2 pb-3"
                >
                  {row.indices.map((i) => {
                    const isSold = sold.has(i);
                    const isHeld = held.has(i);
                    const isSelected = selected.has(i);
                    const kind = SEAT_KINDS[seats.kind[i]] ?? "standard";
                    const taken = isSold || (isHeld && !isSelected);

                    const state = isSelected
                      ? "انتخاب‌شده"
                      : isSold
                        ? "فروخته‌شده"
                        : isHeld
                          ? "رزرو موقت"
                          : "آزاد";

                    return (
                      <li key={i} role="none">
                        <button
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          aria-disabled={taken || undefined}
                          disabled={taken}
                          onClick={() => onToggle(i)}
                          aria-label={[
                            `ردیف ${faDigits(row.label)}`,
                            `صندلی ${faDigits(seats.label[i])}`,
                            KIND_LABEL[kind],
                            price !== undefined ? formatToman(price) : "",
                            state,
                          ]
                            .filter(Boolean)
                            .join("، ")}
                          className={cn(
                            "grid min-h-11 min-w-11 place-items-center rounded-md border px-2 text-xs font-medium tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                            isSelected &&
                              "border-transparent bg-accent text-accent-foreground",
                            !isSelected &&
                              !taken &&
                              "border-border bg-card text-foreground hover:border-accent",
                            taken &&
                              "cursor-not-allowed border-transparent bg-subtle text-faint line-through",
                          )}
                        >
                          {formatNumber(Number(seats.label[i])) ||
                            seats.label[i]}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
