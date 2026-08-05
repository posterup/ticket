"use client";

/**
 * The seat renderer.
 *
 * Canvas 2D, deliberately. A DOM node per seat is unusable past a few hundred;
 * WebGL only starts earning its complexity above roughly 20–30k seats visible
 * at once, and the one-section-at-a-time model never produces that.
 *
 * Three things keep it at 60fps even mid-animation:
 *
 *  * **Batched fills.** Settled seats are grouped into one `Path2D` per visual
 *    state, so most of a 5,000-seat section is four `fill()` calls.
 *  * **A narrow animation window.** Only the few hundred seats currently inside
 *    the reveal wave are drawn individually; everything behind the wave falls
 *    back into the batch.
 *  * **Grid hit-testing.** Pointer lookups index a uniform spatial grid built
 *    once per section, so finding the seat under the cursor is O(1).
 *
 * It shares a camera with the overview, so the two layers stay registered while
 * the view flies into a section.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { faDigits } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SectionSeats } from "@/types";

import type { Camera } from "./useCamera";
import { REVEAL_WINDOW, seatReveal } from "./useReveal";

export type SeatState = "available" | "held" | "sold" | "selected";

interface Props {
  seats: SectionSeats;
  sold: Set<number>;
  held: Set<number>;
  selected: Set<number>;
  onToggle: (index: number) => void;
  camera: Camera;
  color: string;
  /** 0 → 1 entrance wave. */
  reveal: number;
  /** Index → 0..1 click confirmation. */
  popped: Map<number, number>;
  className?: string;
}

const SEAT_RADIUS = 0.42;

/**
 * Seats that are not simply "a seat".
 *
 * Indices into `SEAT_KINDS`: 1 wheelchair, 2 companion, 3 obstructed. Standard
 * (0) and house (4) need no mark — house seats are never offered.
 */
const MARKED_KINDS = new Set([1, 2, 3]);

const STATE_TOKEN: Record<Exclude<SeatState, "available">, string> = {
  held: "--faint",
  sold: "--faint",
  selected: "--accent",
};

/**
 * The non-colour half of the state signal.
 *
 * Colour alone cannot carry these four states here, and measuring says so
 * rather than taste: the authored section palette is deliberately iso-luminant
 * — every seeded section colour lands within 0.03 of 4.58:1 against the map's
 * backdrop — so «رزرو موقت» (`--faint`, 5.13:1) sat at **1.12:1** against a
 * free seat in *every* section. Same lightness, different hue, at the size of a
 * dot. A seat someone else was holding looked exactly like a free one, and the
 * only way to find out was to tap it and be told `SEAT_TAKEN`.
 *
 * «فروخته‌شده» failed the other way: `--border-strong` at 45% opacity is
 * **1.20:1** against the backdrop, so a sold seat did not read as *taken*, it
 * read as *absent* — a hole in the map where a seat should be.
 *
 * No fill fixes both. A colour dark enough to clear 3:1 on near-white is by
 * then within 1.6:1 of the section colours, because they occupy the middle of
 * the range. So the states differ in **shape**, which is what WCAG 1.4.1 asks
 * for anyway and what colour-vision deficiency cannot flatten:
 *
 * - free / selected — a filled dot.
 * - held — a filled dot at 58% radius. Present, but not yours.
 * - sold — a hollow ring, no fill. Absent ink is the strongest non-colour cue
 *   there is, it is the convention every seat map already uses, and it makes
 *   the seat *more* legible (a 5.13:1 stroke, up from a 1.20:1 fill) while
 *   leaving it *less* dominant than the free seats around it.
 */
const RADIUS_SCALE: Record<SeatState, number> = {
  available: 1,
  selected: 1,
  held: 0.58,
  sold: 1,
};

function buildGrid(seats: SectionSeats, cell: number) {
  const grid = new Map<string, number[]>();
  for (let i = 0; i < seats.count; i += 1) {
    const key = `${Math.floor(seats.x[i] / cell)}:${Math.floor(seats.y[i] / cell)}`;
    const bucket = grid.get(key);
    if (bucket) bucket.push(i);
    else grid.set(key, [i]);
  }
  return grid;
}

function estimatePitch(seats: SectionSeats): number {
  const first = seats.rows[0];
  if (!first || first.count < 2) return 20;
  const a = first.from;
  return Math.max(6, Math.abs(seats.x[a + 1] - seats.x[a]) || 20);
}

export function SectionCanvas({
  seats,
  sold,
  held,
  selected,
  onToggle,
  camera,
  color,
  reveal,
  popped,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const pitch = useMemo(() => estimatePitch(seats), [seats]);
  const grid = useMemo(() => buildGrid(seats, pitch * 2), [seats, pitch]);

  /**
   * Precomputed once: a section has a handful of these among thousands of
   * ordinary seats, so marking them is a short second pass rather than a
   * per-seat branch in the hot loop.
   */
  const marked = useMemo(
    () => seats.kind.flatMap((k, i) => (MARKED_KINDS.has(k) ? [i] : [])),
    [seats],
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Layout space → device space, from the shared camera.
  const view = useMemo(() => {
    if (!size.w || !camera.w) return { scale: 1, dx: 0, dy: 0 };
    const scale = size.w / camera.w;
    return { scale, dx: -camera.x * scale, dy: -camera.y * scale };
  }, [size, camera]);

  const stateOf = useCallback(
    (i: number): SeatState =>
      selected.has(i)
        ? "selected"
        : sold.has(i)
          ? "sold"
          : held.has(i)
            ? "held"
            : "available",
    [selected, sold, held],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.w || !size.h) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== size.w * dpr || canvas.height !== size.h * dpr) {
      canvas.width = size.w * dpr;
      canvas.height = size.h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    const styles = getComputedStyle(document.documentElement);
    const token = (name: string) =>
      styles.getPropertyValue(name).trim() || "#999";
    const fillFor = (state: SeatState) =>
      state === "available"
        ? color.startsWith("var(")
          ? token(color.slice(4, -1))
          : color
        : token(STATE_TOKEN[state]);

    const { scale, dx, dy } = view;
    const r = Math.max(1.5, pitch * SEAT_RADIUS * scale);

    // Everything behind the wave is settled and can be batched by state.
    const settledUntil =
      reveal >= 1
        ? seats.count
        : Math.max(
            0,
            Math.floor((reveal * (1 + REVEAL_WINDOW) - REVEAL_WINDOW) * seats.count),
          );

    const batch: Record<SeatState, Path2D> = {
      available: new Path2D(),
      held: new Path2D(),
      sold: new Path2D(),
      selected: new Path2D(),
    };

    for (let i = 0; i < settledUntil; i += 1) {
      // A popping seat animates, so it leaves the batch for a moment.
      if (popped.has(i)) continue;
      const cx = seats.x[i] * scale + dx;
      const cy = seats.y[i] * scale + dy;
      // Cheap frustum cull — off-screen seats cost nothing while zoomed in.
      if (cx < -r || cy < -r || cx > size.w + r || cy > size.h + r) continue;
      const state = stateOf(i);
      const sr = r * RADIUS_SCALE[state];
      batch[state].moveTo(cx + sr, cy);
      batch[state].arc(cx, cy, sr, 0, Math.PI * 2);
    }

    // Stroke width for the hollow sold ring. Below ~3px the ring closes up into
    // a dot, which is fine: at that zoom no seat is individually readable.
    const soldStroke = Math.max(1, r * 0.34);

    for (const state of ["sold", "held", "available", "selected"] as const) {
      ctx.globalAlpha = state === "sold" ? 0.8 : 1;
      if (state === "sold") {
        ctx.strokeStyle = fillFor(state);
        ctx.lineWidth = soldStroke;
        ctx.stroke(batch.sold);
        continue;
      }
      ctx.fillStyle = fillFor(state);
      ctx.fill(batch[state]);
    }

    // The wave itself, plus any seat mid-pop.
    const animated = new Set<number>(popped.keys());
    for (let i = settledUntil; i < seats.count; i += 1) animated.add(i);

    for (const i of animated) {
      if (i >= seats.count) continue;
      const t = seatReveal(i, seats.count, reveal);
      if (t <= 0) continue;

      const cx = seats.x[i] * scale + dx;
      const cy = seats.y[i] * scale + dy;
      if (cx < -r * 3 || cy < -r * 3 || cx > size.w + r * 3 || cy > size.h + r * 3) {
        continue;
      }

      const pop = popped.get(i);
      // Overshoot slightly on click, then settle — reads as "taken".
      const popScale =
        pop === undefined ? 1 : 1 + Math.sin(pop * Math.PI) * 0.55;
      const state = stateOf(i);
      // Seats grow into place rather than fading, which survives a busy map.
      // The state's radius scale rides along, so a seat arrives at the size it
      // will settle at instead of resizing once the wave has passed.
      const radius = r * RADIUS_SCALE[state] * (0.35 + 0.65 * t) * popScale;

      ctx.globalAlpha = (state === "sold" ? 0.8 : 1) * t;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      if (state === "sold") {
        ctx.strokeStyle = fillFor(state);
        ctx.lineWidth = soldStroke;
        ctx.stroke();
      } else {
        ctx.fillStyle = fillFor(state);
        ctx.fill();
      }
    }

    /**
     * Mark the seats that differ.
     *
     * Until now the canvas coloured purely by availability, so a wheelchair
     * space looked exactly like any other seat — a wheelchair user could not
     * find one on the map, and anyone else could take one without knowing.
     * The accessible list said so; the picture most people use did not.
     *
     * A ring rather than a different fill, because fill already means
     * availability and overloading it would make "free" unreadable.
     */
    ctx.globalAlpha = 1;
    for (const i of marked) {
      const cx = seats.x[i] * scale + dx;
      const cy = seats.y[i] * scale + dy;
      if (cx < -r || cy < -r || cx > size.w + r || cy > size.h + r) continue;
      // Below the wave, the seat has not arrived yet.
      if (seatReveal(i, seats.count, reveal) <= 0) continue;

      const kind = seats.kind[i];
      ctx.beginPath();
      ctx.arc(cx, cy, r + Math.max(1, r * 0.45), 0, Math.PI * 2);
      ctx.strokeStyle =
        kind === 3 ? token("--faint") : token("--foreground");
      ctx.lineWidth = Math.max(1, r * 0.32);
      // Obstructed is a caveat, not an affordance — it whispers.
      ctx.globalAlpha = kind === 3 ? 0.5 : 0.85;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (hover !== null && !sold.has(hover)) {
      const cx = seats.x[hover] * scale + dx;
      const cy = seats.y[hover] * scale + dy;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 2.5, 0, Math.PI * 2);
      ctx.strokeStyle = token("--foreground");
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // `selected` and `held` reach this through `stateOf`; `sold` is also read
    // directly for the hover ring.
  }, [seats, sold, hover, view, size, pitch, color, reveal, popped, stateOf, marked]);

  useEffect(() => {
    const frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [draw]);

  const seatAt = useCallback(
    (clientX: number, clientY: number): number | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const { scale, dx, dy } = view;
      const lx = (clientX - rect.left - dx) / scale;
      const ly = (clientY - rect.top - dy) / scale;

      const cell = pitch * 2;
      const gx = Math.floor(lx / cell);
      const gy = Math.floor(ly / cell);
      // Generous on touch: a fingertip is wider than a seat.
      let bestDist = (pitch * 0.75) ** 2;
      let best: number | null = null;

      for (let ox = -1; ox <= 1; ox += 1) {
        for (let oy = -1; oy <= 1; oy += 1) {
          for (const i of grid.get(`${gx + ox}:${gy + oy}`) ?? []) {
            const d = (seats.x[i] - lx) ** 2 + (seats.y[i] - ly) ** 2;
            if (d < bestDist) {
              bestDist = d;
              best = i;
            }
          }
        }
      }
      return best;
    },
    [grid, pitch, seats, view],
  );

  return (
    <div ref={wrapRef} className={cn("relative h-full w-full", className)}>
      <canvas
        ref={canvasRef}
        style={{ width: size.w, height: size.h }}
        className="touch-manipulation"
        // Decorative: SeatList carries the accessible tree.
        aria-hidden
        onPointerMove={(e) => setHover(seatAt(e.clientX, e.clientY))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          const i = seatAt(e.clientX, e.clientY);
          if (i !== null && !sold.has(i)) onToggle(i);
        }}
      />
      {hover !== null ? (
        <SeatTooltip
          seats={seats}
          index={hover}
          view={view}
          state={stateOf(hover)}
        />
      ) : null}
    </div>
  );
}

/** Only the kinds a buyer needs warning about; keyed by SEAT_KINDS ordinal. */
const KIND_NOTE: Record<number, string> = {
  1: "ویژه ویلچر",
  2: "همراه",
  3: "دید محدود",
};

function SeatTooltip({
  seats,
  index,
  view,
  state,
}: {
  seats: SectionSeats;
  index: number;
  view: { scale: number; dx: number; dy: number };
  state: SeatState;
}) {
  const row = seats.rows.find((r) => index >= r.from && index < r.from + r.count);
  const left = seats.x[index] * view.scale + view.dx;
  const top = seats.y[index] * view.scale + view.dy;

  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-foreground px-2 py-1 text-xs font-medium text-background shadow-lg"
      style={{ left, top: top - 10 }}
    >
      {row ? `ردیف ${faDigits(row.label)} · ` : ""}
      صندلی {faDigits(seats.label[index])}
      {state === "sold" ? " · فروخته‌شده" : ""}
      {state === "held" ? " · رزرو موقت" : ""}
      {state === "selected" ? " · انتخاب شما" : ""}
      {KIND_NOTE[seats.kind[index]] ? ` · ${KIND_NOTE[seats.kind[index]]}` : ""}
    </div>
  );
}
