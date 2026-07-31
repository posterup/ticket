"use client";

/**
 * The seat-hold countdown.
 *
 * Holds lapse after twenty minutes. Without a visible clock the first a
 * customer knows about it is a "your seats expired" error on submit, after
 * they have typed a name, a phone number and a discount code — and by then
 * someone else may have the seats.
 *
 * Ticking every second only while it matters: the display switches to seconds
 * under two minutes, so above that a slower tick is invisible and cheaper.
 */

import { useEffect, useRef, useState } from "react";

/** Under this, the countdown turns urgent and starts showing seconds. */
export const WARN_AT_SEC = 120;

export type HoldPhase = "none" | "ok" | "warning" | "expired";

export interface HoldTimer {
  /** Whole seconds left, or null when nothing is held. */
  remaining: number | null;
  phase: HoldPhase;
  /** "۱۲:۳۴" — Persian digits, ready to render. */
  label: string;
}

const fa = (n: number) => n.toLocaleString("fa-IR", { minimumIntegerDigits: 2 });

function format(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${fa(m)}:${fa(s)}`;
}

/**
 * @param expiresAt ISO timestamp from the hold response, or null when the
 *   customer holds nothing.
 * @param onExpire Fired once, on the transition to zero — not on every tick
 *   afterwards, or the caller would clear its state repeatedly.
 */
export function useHoldTimer(
  expiresAt: string | null,
  onExpire?: () => void,
): HoldTimer {
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef<string | null>(null);
  const expire = useRef(onExpire);
  expire.current = onExpire;

  useEffect(() => {
    if (!expiresAt) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  useEffect(() => {
    if (!expiresAt) {
      fired.current = null;
      return;
    }
    const left = new Date(expiresAt).getTime() - now;
    // Keyed on the timestamp so a fresh hold re-arms the callback.
    if (left <= 0 && fired.current !== expiresAt) {
      fired.current = expiresAt;
      expire.current?.();
    }
  }, [expiresAt, now]);

  if (!expiresAt) return { remaining: null, phase: "none", label: "" };

  const remaining = Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - now) / 1000),
  );

  return {
    remaining,
    phase: remaining <= 0 ? "expired" : remaining <= WARN_AT_SEC ? "warning" : "ok",
    label: format(remaining),
  };
}
