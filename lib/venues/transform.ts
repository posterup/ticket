/**
 * Section transforms.
 *
 * A section is a shape *and* a seat lattice, and the two must move together —
 * translating the outline while leaving `rows.origin` behind is how a stand and
 * its seats come apart. Every transform here moves both.
 *
 * All of them are **absolute**: they take the section as it was when the drag
 * started and return what it should be now. Applying incremental deltas on each
 * pointer-move accumulates float drift, so dragging a corner out and back would
 * not return the section to where it began.
 *
 * Pure — the designer canvas uses these for the live preview and the reducer
 * uses them to commit, so what you drag is exactly what gets stored.
 */

import type { LayoutBounds, SectionSpec } from "@/types";

import {
  type Box,
  boundsOf,
  centroidOf,
  mirrorShape,
  rotateShape,
  scaleShape,
  translateShape,
} from "./geometry";

export function moveSection(
  section: SectionSpec,
  dx: number,
  dy: number,
): SectionSpec {
  return {
    ...section,
    shape: translateShape(section.shape, dx, dy),
    labelAt: section.labelAt
      ? [section.labelAt[0] + dx, section.labelAt[1] + dy]
      : undefined,
    rows: section.rows
      ? {
          ...section.rows,
          origin: [section.rows.origin[0] + dx, section.rows.origin[1] + dy],
        }
      : undefined,
  };
}

/**
 * Resize to an absolute bounding box.
 *
 * Seat spacing scales with the block so density holds — stretching a stand
 * wider should fit more seats at the same pitch only if the operator raises the
 * seat count; it should not silently re-space the ones already there.
 */
export function resizeSection(section: SectionSpec, target: Box): SectionSpec {
  const from = boundsOf(section.shape);
  if (from.w <= 0 || from.h <= 0) return section;

  const sx = target.w / from.w;
  const sy = target.h / from.h;
  const about = { x: from.x, y: from.y };

  const scaled = scaleShape(section.shape, sx, sy, about);
  // Scaling about the old top-left leaves the box at the old origin; shift it
  // onto the target.
  const after = boundsOf(scaled);
  const dx = target.x - after.x;
  const dy = target.y - after.y;

  const mapPoint = (p: [number, number]): [number, number] => [
    about.x + (p[0] - about.x) * sx + dx,
    about.y + (p[1] - about.y) * sy + dy,
  ];

  return {
    ...section,
    shape: translateShape(scaled, dx, dy),
    labelAt: section.labelAt ? mapPoint(section.labelAt) : undefined,
    rows: section.rows
      ? {
          ...section.rows,
          spacing: section.rows.spacing * sy,
          seatSpacing: section.rows.seatSpacing * sx,
          origin: mapPoint(section.rows.origin),
        }
      : undefined,
  };
}

/** Rotate by `deg` about the section's own centre. */
export function rotateSection(section: SectionSpec, deg: number): SectionSpec {
  if (!deg) return section;
  const c = centroidOf(section.shape);
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const spin = (p: [number, number]): [number, number] => {
    const dx = p[0] - c.x;
    const dy = p[1] - c.y;
    return [c.x + dx * cos - dy * sin, c.y + dx * sin + dy * cos];
  };

  return {
    ...section,
    shape: rotateShape(section.shape, deg),
    labelAt: section.labelAt ? spin(section.labelAt) : undefined,
    rows: section.rows
      ? {
          ...section.rows,
          angle: section.rows.angle + deg,
          origin: spin(section.rows.origin),
        }
      : undefined,
  };
}

/**
 * Mirror across the venue centre line.
 *
 * The numbering origin flips with it: the opposite stand's seat 1 is on the
 * other side, or the two stands read as mirror images of each other and the
 * ushers hate you.
 */
export function mirrorSection(
  section: SectionSpec,
  axis: "horizontal" | "vertical",
  bounds: LayoutBounds,
): SectionSpec {
  const shape = mirrorShape(section.shape, axis, bounds);
  const c = centroidOf(shape);

  return {
    ...section,
    shape,
    labelAt: undefined,
    rows: section.rows
      ? {
          ...section.rows,
          origin: [c.x, c.y - (section.rows.count * section.rows.spacing) / 2],
          numbering: {
            ...section.rows.numbering,
            seatOrigin:
              section.rows.numbering.seatOrigin === "left" ? "right" : "left",
          },
        }
      : undefined,
  };
}

/** Drag one vertex of a polygon section. No-op on rects and arcs. */
export function movePolygonPoint(
  section: SectionSpec,
  index: number,
  x: number,
  y: number,
): SectionSpec {
  if (section.shape.type !== "polygon") return section;
  const points = section.shape.points.map(
    (p, i) => (i === index ? [x, y] : p) as [number, number],
  );
  return { ...section, shape: { ...section.shape, points } };
}

/** The eight resize grips, named by the corner or edge they sit on. */
export type ResizeHandle =
  | "nw" | "n" | "ne"
  | "w"  |        "e"
  | "sw" | "s" | "se";

/**
 * The box a resize drag implies.
 *
 * The opposite corner is the anchor and stays put, which is what makes dragging
 * the top-left grow the section up and to the left rather than sliding it.
 * `min` stops a section being collapsed to nothing and becoming unclickable.
 */
export function boxForHandle(
  start: Box,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  min = 20,
): Box {
  let { x, y, w, h } = start;

  if (handle.includes("w")) {
    const nw = Math.max(min, w - dx);
    x += w - nw;
    w = nw;
  }
  if (handle.includes("e")) w = Math.max(min, w + dx);
  if (handle.includes("n")) {
    const nh = Math.max(min, h - dy);
    y += h - nh;
    h = nh;
  }
  if (handle.includes("s")) h = Math.max(min, h + dy);

  return { x, y, w, h };
}
