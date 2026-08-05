"use client";

/**
 * The shared camera.
 *
 * The overview (SVG) and the seat layer (canvas) are two elements drawing the
 * same world, so they cannot each own a viewport — the moment one animates, the
 * seats slide off their section. One camera in layout coordinates drives both:
 * the SVG feeds it to `viewBox`, the canvas turns it into a scale and offset.
 *
 * Movement is eased rather than sprung. A spring overshoots, and overshooting a
 * seat map means the seats the customer is reaching for move past their finger.
 */

import { useEffect, useRef, useState } from "react";

export interface Camera {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Flight time. Long enough to read as movement, short enough not to be a wait. */
const DURATION_MS = 620;

/** Cubic ease-out: quick departure, soft arrival. */
const ease = (t: number): number => 1 - (1 - t) ** 3;

const same = (a: Camera, b: Camera): boolean =>
  Math.abs(a.x - b.x) < 0.5 &&
  Math.abs(a.y - b.y) < 0.5 &&
  Math.abs(a.w - b.w) < 0.5 &&
  Math.abs(a.h - b.h) < 0.5;

/**
 * Fly toward `target`, returning the camera for this frame.
 *
 * Re-targeting mid-flight starts a new leg from wherever the camera actually
 * is, so tapping a second section while the first is still animating turns
 * smoothly instead of snapping back.
 */
export function useCamera(target: Camera, reduced: boolean): Camera {
  // Destructured so the effect depends on the camera's *values*. Depending on
  // the object would restart the flight every time a poll produced an
  // identical box.
  const { x: tx, y: ty, w: tw, h: th } = target;
  const [camera, setCamera] = useState<Camera>(target);
  const from = useRef<Camera>(target);
  const startedAt = useRef<number>(0);
  const frame = useRef<number>(0);
  const latest = useRef<Camera>(camera);
  latest.current = camera;

  useEffect(() => {
    if (reduced) {
      setCamera({ x: tx, y: ty, w: tw, h: th });
      return;
    }
    const to = { x: tx, y: ty, w: tw, h: th };
    if (same(latest.current, to)) return;

    from.current = latest.current;
    startedAt.current = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt.current) / DURATION_MS);
      const k = ease(t);
      const a = from.current;

      setCamera({
        x: a.x + (to.x - a.x) * k,
        y: a.y + (to.y - a.y) * k,
        w: a.w + (to.w - a.w) * k,
        h: a.h + (to.h - a.h) * k,
      });

      if (t < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [tx, ty, tw, th, reduced]);

  return camera;
}

/**
 * Fit a box into a viewport of a given aspect ratio, with breathing room.
 *
 * Without this the camera crops a wide stand to the container's aspect and the
 * ends of every row fall outside the frame.
 */
export function fitBox(
  box: { x: number; y: number; w: number; h: number },
  aspect: number,
  padding = 0.12,
): Camera {
  const padW = box.w * (1 + padding * 2);
  const padH = box.h * (1 + padding * 2);

  let w = padW;
  let h = padH;
  if (padW / padH > aspect) h = padW / aspect;
  else w = padH * aspect;

  return {
    x: box.x + box.w / 2 - w / 2,
    y: box.y + box.h / 2 - h / 2,
    w,
    h,
  };
}
