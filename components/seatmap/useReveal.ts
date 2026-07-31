"use client";

/**
 * The seat entrance.
 *
 * Seats appear in a wave rather than all at once — it reads as the section
 * filling in, and it hides the fact that a few thousand circles just arrived.
 *
 * The wave is expressed as a single progress value, not per-seat state. A
 * per-seat spring for 5,000 seats is 5,000 objects mutating every frame; one
 * number and a bit of arithmetic in the draw loop is free. The renderer turns
 * it into "seats before this index are done, the next few hundred are fading",
 * which keeps the fully-revealed majority batchable.
 */

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 700;

/** Fraction of the section in flight at any instant — the width of the wave. */
export const REVEAL_WINDOW = 0.14;

const ease = (t: number): number => 1 - (1 - t) ** 3;

/**
 * Restarts whenever `key` changes — i.e. per section, so switching sections
 * replays the entrance rather than snapping the new seats in.
 *
 * Returns 1 immediately under `prefers-reduced-motion`: the wave is decoration,
 * and someone who asked for less motion should still get their seats.
 */
export function useReveal(key: string | null, reduced: boolean): number {
  const [progress, setProgress] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    if (!key) {
      setProgress(0);
      return;
    }
    if (reduced) {
      setProgress(1);
      return;
    }

    const startedAt = performance.now();
    setProgress(0);

    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / DURATION_MS);
      setProgress(ease(t));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [key, reduced]);

  return progress;
}

/**
 * How far in a seat is, 0 → 1.
 *
 * The wave sweeps in seat order, which is row-major, so a section fills row by
 * row from the stage back.
 */
export function seatReveal(
  index: number,
  count: number,
  progress: number,
): number {
  if (progress >= 1) return 1;
  const at = count > 1 ? index / (count - 1) : 0;
  // Progress runs past 1 by the window width so the last seat still completes.
  const head = progress * (1 + REVEAL_WINDOW);
  return Math.max(0, Math.min(1, (head - at) / REVEAL_WINDOW));
}

/**
 * A short pop when a seat is clicked.
 *
 * Confirmation is the point: the seat is only ours once the server grants the
 * hold, so the pop lands on the state change rather than on the tap.
 */
export function usePop(duration = 260): {
  popped: Map<number, number>;
  pop: (index: number) => void;
} {
  const [, force] = useState(0);
  const startedAt = useRef(new Map<number, number>());
  const frame = useRef(0);

  const pop = (index: number) => {
    startedAt.current.set(index, performance.now());
    const tick = () => {
      const now = performance.now();
      for (const [i, t] of startedAt.current) {
        if (now - t > duration) startedAt.current.delete(i);
      }
      force((n) => n + 1);
      if (startedAt.current.size) frame.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const now = performance.now();
  const popped = new Map<number, number>();
  for (const [i, t] of startedAt.current) {
    popped.set(i, Math.min(1, (now - t) / duration));
  }

  return { popped, pop };
}
