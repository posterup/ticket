/**
 * Layout geometry helpers.
 *
 * Everything here is pure and unit-tested. The admin designer and the publish
 * compiler share it, so a section's on-screen shape in the editor and the seats
 * materialised at publish come from one implementation rather than two that
 * drift.
 */

import type {
  ArcShape,
  LayoutBounds,
  Point,
  RectShape,
  SectionShape,
} from "@/types";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Rotate `p` about `origin` by `deg` clockwise. */
export function rotatePoint(p: Point, origin: Point, deg: number): Point {
  if (!deg) return p;
  const a = rad(deg);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

export function rectCorners(rect: RectShape): Point[] {
  const centre = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
  const corners: Point[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h },
  ];
  return rect.rotation
    ? corners.map((c) => rotatePoint(c, centre, rect.rotation as number))
    : corners;
}

/** Sample an arc band's outline. Used for hit-testing and bounds, not drawing. */
export function arcOutline(arc: ArcShape, steps = 24): Point[] {
  const outer: Point[] = [];
  const inner: Point[] = [];
  const sweep = arc.endAngle - arc.startAngle;
  for (let i = 0; i <= steps; i += 1) {
    const a = rad(arc.startAngle + (sweep * i) / steps);
    outer.push({
      x: arc.cx + Math.cos(a) * arc.rOuter,
      y: arc.cy + Math.sin(a) * arc.rOuter,
    });
    inner.push({
      x: arc.cx + Math.cos(a) * arc.rInner,
      y: arc.cy + Math.sin(a) * arc.rInner,
    });
  }
  return [...outer, ...inner.reverse()];
}

export function shapePoints(shape: SectionShape): Point[] {
  switch (shape.type) {
    case "rect":
      return rectCorners(shape);
    case "polygon":
      return shape.points.map(([x, y]) => ({ x, y }));
    case "arc":
      return arcOutline(shape);
  }
}

export function boundsOf(shape: SectionShape): Box {
  const pts = shapePoints(shape);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function centroidOf(shape: SectionShape): Point {
  const b = boundsOf(shape);
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

/** Even-odd ray cast. Good enough for the polygons a venue actually contains. */
export function pointInPolygon(p: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const straddles = a.y > p.y !== b.y > p.y;
    if (!straddles) continue;
    const xAt = ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (p.x < xAt) inside = !inside;
  }
  return inside;
}

export function pointInShape(p: Point, shape: SectionShape): boolean {
  return pointInPolygon(p, shapePoints(shape));
}

// ───────────────────────────── transforms ─────────────────────────────

export function translateShape(
  shape: SectionShape,
  dx: number,
  dy: number,
): SectionShape {
  switch (shape.type) {
    case "rect":
      return { ...shape, x: shape.x + dx, y: shape.y + dy };
    case "polygon":
      return {
        ...shape,
        points: shape.points.map(([x, y]) => [x + dx, y + dy]),
      };
    case "arc":
      return { ...shape, cx: shape.cx + dx, cy: shape.cy + dy };
  }
}

export function scaleShape(
  shape: SectionShape,
  sx: number,
  sy: number,
  about: Point,
): SectionShape {
  const map = (p: Point): Point => ({
    x: about.x + (p.x - about.x) * sx,
    y: about.y + (p.y - about.y) * sy,
  });
  switch (shape.type) {
    case "rect": {
      const tl = map({ x: shape.x, y: shape.y });
      return { ...shape, x: tl.x, y: tl.y, w: shape.w * sx, h: shape.h * sy };
    }
    case "polygon":
      return {
        ...shape,
        points: shape.points.map(([x, y]) => {
          const p = map({ x, y });
          return [p.x, p.y];
        }),
      };
    case "arc": {
      const c = map({ x: shape.cx, y: shape.cy });
      const k = (sx + sy) / 2;
      return {
        ...shape,
        cx: c.x,
        cy: c.y,
        rInner: shape.rInner * k,
        rOuter: shape.rOuter * k,
      };
    }
  }
}

export function rotateShape(shape: SectionShape, deg: number): SectionShape {
  const c = centroidOf(shape);
  switch (shape.type) {
    case "rect":
      return { ...shape, rotation: (shape.rotation ?? 0) + deg };
    case "polygon":
      return {
        ...shape,
        points: shape.points.map(([x, y]) => {
          const p = rotatePoint({ x, y }, c, deg);
          return [p.x, p.y];
        }),
      };
    case "arc":
      return {
        ...shape,
        startAngle: shape.startAngle + deg,
        endAngle: shape.endAngle + deg,
      };
  }
}

/**
 * Mirror across the layout's centre line.
 *
 * Mirroring about the section's own centroid would leave it exactly where it
 * was, which is never what the operator wants — the point of mirroring a stand
 * is to produce its opposite number across the venue.
 */
export function mirrorShape(
  shape: SectionShape,
  axis: "horizontal" | "vertical",
  bounds: LayoutBounds,
): SectionShape {
  const mid = axis === "horizontal" ? bounds.width / 2 : bounds.height / 2;
  const flip = (p: Point): Point =>
    axis === "horizontal"
      ? { x: 2 * mid - p.x, y: p.y }
      : { x: p.x, y: 2 * mid - p.y };

  switch (shape.type) {
    case "rect": {
      const corner = flip({ x: shape.x + shape.w, y: shape.y + shape.h });
      return axis === "horizontal"
        ? { ...shape, x: corner.x, rotation: -(shape.rotation ?? 0) }
        : { ...shape, y: corner.y, rotation: -(shape.rotation ?? 0) };
    }
    case "polygon":
      return {
        ...shape,
        // Reverse to keep the winding order, so fills stay consistent.
        points: shape.points
          .map(([x, y]) => {
            const p = flip({ x, y });
            return [p.x, p.y] as [number, number];
          })
          .reverse(),
      };
    case "arc": {
      const c = flip({ x: shape.cx, y: shape.cy });
      return {
        ...shape,
        cx: c.x,
        cy: c.y,
        startAngle: 180 - shape.endAngle,
        endAngle: 180 - shape.startAngle,
      };
    }
  }
}

/** SVG path data. Shared by the designer canvas and the customer overview. */
export function shapeToPath(shape: SectionShape): string {
  const pts = shapePoints(shape);
  if (!pts.length) return "";
  const [head, ...rest] = pts;
  return `M ${head.x} ${head.y} ${rest
    .map((p) => `L ${p.x} ${p.y}`)
    .join(" ")} Z`;
}
