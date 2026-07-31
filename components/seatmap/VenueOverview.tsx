"use client";

/**
 * The orientation map.
 *
 * SVG, not canvas. A venue has tens of sections, not thousands, so the DOM cost
 * is trivial — and in exchange every section is a real `<button>` with a real
 * label, which means keyboard navigation and screen-reader support come for
 * free rather than being rebuilt by hand on top of a canvas.
 *
 * This never renders an individual seat. Its whole job is answering "where is
 * the stage, and which block am I buying into".
 */

import { memo } from "react";

import { cn } from "@/lib/utils";
import { formatNumber, formatToman } from "@/lib/format";
import { shapeToPath } from "@/lib/venues/geometry";
import type {
  AvailabilityIndicator,
  OverviewSection,
  SectionAvailability,
  VenueOverview as Overview,
} from "@/types";

import type { Camera } from "./useCamera";

const INDICATOR_LABEL: Record<AvailabilityIndicator, string> = {
  available: "موجود",
  limited: "رو به اتمام",
  "almost-full": "تقریباً پر",
  "sold-out": "تکمیل",
};

/**
 * Bucketed, never a raw count.
 *
 * Under a live on-sale an exact "۱۷۸ صندلی آزاد" is wrong by the time it
 * paints. A bucket degrades honestly; a number lies precisely.
 */
const INDICATOR_CLASS: Record<AvailabilityIndicator, string> = {
  available: "fill-success",
  limited: "fill-warning",
  "almost-full": "fill-warning",
  "sold-out": "fill-faint",
};

interface Props {
  overview: Overview;
  availability: Map<string, SectionAvailability>;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onPrefetch?: (key: string) => void;
  /** Dim everything but the open section, so context survives the drill-in. */
  dimUnselected?: boolean;
  /** Shared with the seat canvas, so both layers fly together. */
  camera: Camera;
  /** Fade section captions out as the view closes in on one. */
  zoomed?: boolean;
  className?: string;
}

/**
 * Halo behind the section captions.
 *
 * A light one, because the captions are now dark. They used to be `fill-white`
 * over a dark halo, which reads as the obvious choice — the fills are brand
 * colours, and white sits on all five of them at ~4.58:1. But the fill is
 * painted at `fillOpacity` 0.72, and *that* is what the text sits on: 72% of a
 * mid-tone over a near-white card is a pastel. The section names — the primary
 * navigation of the whole map, in the state a buyer spends all their time in —
 * measured **2.85–3.40:1**, below even the large-text bar. Sold-out sections
 * take a further `opacity-40` and reached **1.47:1**.
 *
 * `--foreground` inverts it, because a diluted fill can only ever be lighter
 * than the colour it came from: 5.49–6.55:1 unselected and 11.4–12.7:1 sold
 * out, with the same fills and the same airy look.
 *
 * The one state that does not clear AA outright is a *selected* section, where
 * `fillOpacity` rises to 0.95 and the fill is nearly the saturated colour
 * (4.20–4.42:1). White is no better there — 4.23–4.45 — because a 0.95 fill of
 * a mid-tone sits near the crossover where neither ink wins. It clears 3:1, so
 * the 22px bold name is fine; the 17px price line beside it is the part that is
 * technically short, and it is also the moment the caption is about to fade out
 * (`opacity={zoomed && isSelected ? 0 : 1}`) and the same price is showing in
 * the sidebar.
 */
const LABEL_HALO = "rgba(255,255,255,.75)";

function sectionFill(section: OverviewSection): string {
  // Design tokens where the designer chose one, raw value otherwise.
  return section.color.startsWith("#")
    ? section.color
    : `var(--${section.color})`;
}

export const VenueOverview = memo(function VenueOverview({
  overview,
  availability,
  selectedKey,
  onSelect,
  onPrefetch,
  dimUnselected = false,
  camera,
  zoomed = false,
  className,
}: Props) {
  const { bounds, stage, sections } = overview;

  return (
    <svg
      viewBox={`${camera.x} ${camera.y} ${camera.w} ${camera.h}`}
      className={cn("h-full w-full touch-manipulation", className)}
      role="group"
      aria-label={`نقشه ${overview.venueName}`}
    >
      {stage ? (
        <g aria-hidden>
          <path
            d={shapeToPath(stage.shape)}
            className="fill-foreground opacity-90"
          />
          <text
            x={bounds.width / 2}
            y={stageLabelY(stage.shape, bounds.height)}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-background text-[26px] font-bold"
          >
            {stage.label}
          </text>
        </g>
      ) : null}

      {sections.map((section) => {
        const info = availability.get(section.key);
        const indicator = info?.indicator ?? "available";
        const isSelected = selectedKey === section.key;
        const dimmed = dimUnselected && !isSelected;
        const soldOut = indicator === "sold-out";

        const label = [
          section.name,
          info ? INDICATOR_LABEL[indicator] : null,
          info?.priceFrom !== undefined
            ? `از ${formatToman(info.priceFrom)}`
            : null,
          info ? `${formatNumber(info.available)} جای خالی` : null,
        ]
          .filter(Boolean)
          .join("، ");

        return (
          <g
            key={section.key}
            role="button"
            tabIndex={soldOut ? -1 : 0}
            aria-label={label}
            aria-disabled={soldOut || undefined}
            aria-pressed={isSelected}
            onClick={() => !soldOut && onSelect(section.key)}
            onKeyDown={(e) => {
              if (soldOut) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(section.key);
              }
            }}
            onPointerEnter={() => !soldOut && onPrefetch?.(section.key)}
            onFocus={() => !soldOut && onPrefetch?.(section.key)}
            className={cn(
              "transition-opacity duration-200",
              /*
                No `outline-none` here.

                These `<g role="button" tabIndex={0}>` are how a keyboard user
                moves around the venue, and the class killed the browser's focus
                ring without putting anything back — so tabbing through a map
                showed which section was focused precisely nowhere. The
                *captions* were made readable two changes ago; this is the other
                half of being able to use the thing.

                The native outline rather than a `ring-*`: Tailwind's ring is a
                `box-shadow`, and SVG elements do not paint one. `outline` they
                do, and it comes with the platform's own high-contrast handling
                for free.
              */
              "outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent",
              soldOut ? "cursor-not-allowed" : "cursor-pointer",
              dimmed ? "opacity-25" : "opacity-100",
            )}
          >
            <path
              d={shapeToPath(section.shape)}
              fill={sectionFill(section)}
              className={cn(
                "transition-[stroke-width]",
                soldOut && "opacity-40",
              )}
              fillOpacity={isSelected ? 0.95 : 0.72}
              stroke="var(--foreground)"
              strokeOpacity={isSelected ? 0.9 : 0.15}
              strokeWidth={isSelected ? 4 : 1.5}
            />

            <text
              x={section.labelAt[0]}
              y={section.labelAt[1] - 8}
              opacity={zoomed && isSelected ? 0 : 1}
              textAnchor="middle"
              dominantBaseline="middle"
              className="pointer-events-none fill-foreground text-[22px] font-bold"
              style={{ paintOrder: "stroke", stroke: LABEL_HALO, strokeWidth: 4 }}
            >
              {section.name}
            </text>

            {info && !(zoomed && isSelected) ? (
              <>
                <circle
                  cx={section.labelAt[0] - 46}
                  cy={section.labelAt[1] + 18}
                  r={6}
                  className={cn("pointer-events-none", INDICATOR_CLASS[indicator])}
                />
                <text
                  x={section.labelAt[0]}
                  y={section.labelAt[1] + 20}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none fill-foreground text-[17px] font-medium"
                  style={{
                    paintOrder: "stroke",
                    stroke: LABEL_HALO,
                    strokeWidth: 3,
                  }}
                >
                  {soldOut
                    ? INDICATOR_LABEL["sold-out"]
                    : info.priceFrom !== undefined
                      ? `از ${formatToman(info.priceFrom)}`
                      : INDICATOR_LABEL[indicator]}
                </text>
              </>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
});

/** Keep the stage caption inside its block whatever shape it was drawn as. */
function stageLabelY(shape: Overview["stage"] extends undefined ? never : NonNullable<Overview["stage"]>["shape"], fallback: number): number {
  if (shape.type === "rect") return shape.y + shape.h / 2;
  if (shape.type === "polygon") {
    const ys = shape.points.map(([, y]) => y);
    return (Math.min(...ys) + Math.max(...ys)) / 2;
  }
  return fallback / 2;
}
