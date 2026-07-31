"use client";

/**
 * The editing surface.
 *
 * Two layers, each playing to its strengths:
 *
 *  * A **canvas** underneath draws every generated seat. A stadium draft is
 *    thousands of dots that redraw on every keystroke in the inspector; SVG
 *    would fall over.
 *  * An **SVG** layer on top carries section outlines, grips and the drawing
 *    tool, because those are a handful of nodes that need real hit-testing,
 *    cursors and focus.
 *
 * Direct manipulation throughout: drag to move, grips to resize, a handle to
 * rotate, vertices to reshape a polygon. Every gesture is bracketed by
 * `beginGesture`/`endGesture` so it lands as **one** undo step, and every frame
 * recomputes from the section as it was when the drag started, so dragging out
 * and back returns exactly where it began.
 *
 * The seat preview is regenerated with the same `generateSection` the publish
 * step uses — the preview is not an approximation of the output, it *is* the
 * output.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { type Box, boundsOf, shapeToPath } from "@/lib/venues/geometry";
import { generateSection } from "@/lib/venues/spec";
import {
  boxForHandle,
  movePolygonPoint,
  resizeSection,
  rotateSection,
  moveSection,
  type ResizeHandle,
} from "@/lib/venues/transform";
import type { LayoutSpec, SectionShape, SectionSpec } from "@/types";

export type Tool = "select" | "rect" | "polygon" | "stage";

interface Props {
  spec: LayoutSpec;
  selected: string | null;
  tool: Tool;
  onSelect: (key: string | null) => void;
  onBeginGesture: () => void;
  onEndGesture: () => void;
  onReplace: (key: string, section: SectionSpec) => void;
  onDrawRect: (shape: SectionShape) => void;
  onDrawPolygon: (points: [number, number][]) => void;
  onPlaceStage: (x: number, y: number) => void;
  className?: string;
}

const GRID = 10;
const snap = (v: number) => Math.round(v / GRID) * GRID;

const HANDLES: { id: ResizeHandle; fx: number; fy: number; cursor: string }[] = [
  { id: "nw", fx: 0, fy: 0, cursor: "nwse-resize" },
  { id: "n", fx: 0.5, fy: 0, cursor: "ns-resize" },
  { id: "ne", fx: 1, fy: 0, cursor: "nesw-resize" },
  { id: "e", fx: 1, fy: 0.5, cursor: "ew-resize" },
  { id: "se", fx: 1, fy: 1, cursor: "nwse-resize" },
  { id: "s", fx: 0.5, fy: 1, cursor: "ns-resize" },
  { id: "sw", fx: 0, fy: 1, cursor: "nesw-resize" },
  { id: "w", fx: 0, fy: 0.5, cursor: "ew-resize" },
];

type Drag =
  | { kind: "move"; from: SectionSpec; ox: number; oy: number }
  | { kind: "resize"; from: SectionSpec; handle: ResizeHandle; box: Box; ox: number; oy: number }
  | { kind: "rotate"; from: SectionSpec; cx: number; cy: number; start: number }
  | { kind: "vertex"; from: SectionSpec; index: number }
  | { kind: "pan"; ox: number; oy: number; vx: number; vy: number };

export function DesignerCanvas({
  spec,
  selected,
  tool,
  onSelect,
  onBeginGesture,
  onEndGesture,
  onReplace,
  onDrawRect,
  onDrawPolygon,
  onPlaceStage,
  className,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const drag = useRef<Drag | null>(null);

  /** Viewport in layout units. Panning and zooming only move this. */
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  /** Vertices placed so far by the polygon tool. */
  const [draft, setDraft] = useState<[number, number][]>([]);
  /** Rubber-band rectangle while the rect tool is dragging. */
  const [rubber, setRubber] = useState<Box | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const vb = useMemo(
    () => ({
      x: view.x,
      y: view.y,
      w: spec.bounds.width / view.zoom,
      h: spec.bounds.height / view.zoom,
    }),
    [view, spec.bounds],
  );

  const scale = size.w ? size.w / vb.w : 1;

  const seatLayers = useMemo(
    () =>
      spec.sections
        .filter((s) => s.kind === "seated")
        // generateSection also returns `key`, so spread first.
        .map((s) => ({ ...generateSection(s), key: s.key, color: s.color })),
    [spec.sections],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.w || !size.h) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    for (const layer of seatLayers) {
      if (!layer.seats.length) continue;
      const a = layer.seats[0];
      const b = layer.seats[1];
      const pitch = b && a ? Math.abs(b.x - a.x) || 14 : 14;
      const r = Math.max(0.7, pitch * 0.36 * scale);

      const path = new Path2D();
      for (const seat of layer.seats) {
        const cx = (seat.x - vb.x) * scale;
        const cy = (seat.y - vb.y) * scale;
        if (cx < -r || cy < -r || cx > size.w + r || cy > size.h + r) continue;
        path.moveTo(cx + r, cy);
        path.arc(cx, cy, r, 0, Math.PI * 2);
      }
      ctx.fillStyle = layer.color.startsWith("#") ? layer.color : "#1b6df5";
      ctx.globalAlpha = selected && selected !== layer.key ? 0.3 : 0.95;
      ctx.fill(path);
    }
    ctx.globalAlpha = 1;
  }, [seatLayers, scale, size, selected, vb]);

  /** Screen → layout coordinates. */
  const toLayout = useCallback(
    (e: { clientX: number; clientY: number }): { x: number; y: number } => {
      const rect = wrapRef.current!.getBoundingClientRect();
      return {
        x: vb.x + (e.clientX - rect.left) / scale,
        y: vb.y + (e.clientY - rect.top) / scale,
      };
    },
    [vb, scale],
  );

  const sectionOf = (key: string | null) =>
    spec.sections.find((s) => s.key === key);

  // ─────────────────────── gestures ───────────────────────

  const startMove = (e: React.PointerEvent, section: SectionSpec) => {
    const p = toLayout(e);
    onSelect(section.key);
    onBeginGesture();
    drag.current = { kind: "move", from: section, ox: p.x, oy: p.y };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const startResize = (
    e: React.PointerEvent,
    section: SectionSpec,
    handle: ResizeHandle,
  ) => {
    e.stopPropagation();
    const p = toLayout(e);
    onBeginGesture();
    drag.current = {
      kind: "resize",
      from: section,
      handle,
      box: boundsOf(section.shape),
      ox: p.x,
      oy: p.y,
    };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const startRotate = (e: React.PointerEvent, section: SectionSpec) => {
    e.stopPropagation();
    const box = boundsOf(section.shape);
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const p = toLayout(e);
    onBeginGesture();
    drag.current = {
      kind: "rotate",
      from: section,
      cx,
      cy,
      start: Math.atan2(p.y - cy, p.x - cx),
    };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const startVertex = (
    e: React.PointerEvent,
    section: SectionSpec,
    index: number,
  ) => {
    e.stopPropagation();
    onBeginGesture();
    drag.current = { kind: "vertex", from: section, index };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toLayout(e);

    switch (d.kind) {
      case "move": {
        const dx = snap(p.x - d.ox);
        const dy = snap(p.y - d.oy);
        onReplace(d.from.key, moveSection(d.from, dx, dy));
        break;
      }
      case "resize": {
        const box = boxForHandle(d.box, d.handle, p.x - d.ox, p.y - d.oy);
        onReplace(
          d.from.key,
          resizeSection(d.from, {
            x: snap(box.x),
            y: snap(box.y),
            w: Math.max(GRID, snap(box.w)),
            h: Math.max(GRID, snap(box.h)),
          }),
        );
        break;
      }
      case "rotate": {
        const now = Math.atan2(p.y - d.cy, p.x - d.cx);
        let deg = ((now - d.start) * 180) / Math.PI;
        // Shift snaps to 15°, the way every design tool does it.
        if (e.shiftKey) deg = Math.round(deg / 15) * 15;
        onReplace(d.from.key, rotateSection(d.from, deg));
        break;
      }
      case "vertex": {
        onReplace(
          d.from.key,
          movePolygonPoint(d.from, d.index, snap(p.x), snap(p.y)),
        );
        break;
      }
      case "pan": {
        const rect = wrapRef.current!.getBoundingClientRect();
        setView((v) => ({
          ...v,
          x: d.vx - (e.clientX - rect.left - d.ox) / scale,
          y: d.vy - (e.clientY - rect.top - d.oy) / scale,
        }));
        break;
      }
    }
  };

  const endDrag = () => {
    if (drag.current && drag.current.kind !== "pan") onEndGesture();
    drag.current = null;
  };

  // ─────────────────────── tools ───────────────────────

  const onSurfaceDown = (e: React.PointerEvent) => {
    const p = toLayout(e);

    if (tool === "stage") {
      onPlaceStage(snap(p.x), snap(p.y));
      return;
    }
    if (tool === "polygon") {
      setDraft((d) => [...d, [snap(p.x), snap(p.y)]]);
      return;
    }
    if (tool === "rect") {
      setRubber({ x: snap(p.x), y: snap(p.y), w: 0, h: 0 });
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }
    // Select tool on empty space: middle-drag or space-drag pans, click clears.
    if (e.button === 1 || e.altKey) {
      const rect = wrapRef.current!.getBoundingClientRect();
      drag.current = {
        kind: "pan",
        ox: e.clientX - rect.left,
        oy: e.clientY - rect.top,
        vx: vb.x,
        vy: vb.y,
      };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }
    onSelect(null);
  };

  const onSurfaceMove = (e: React.PointerEvent) => {
    if (rubber) {
      const p = toLayout(e);
      setRubber((r) =>
        r ? { ...r, w: snap(p.x) - r.x, h: snap(p.y) - r.y } : r,
      );
      return;
    }
    onPointerMove(e);
  };

  const onSurfaceUp = () => {
    if (rubber) {
      const norm: Box = {
        x: rubber.w < 0 ? rubber.x + rubber.w : rubber.x,
        y: rubber.h < 0 ? rubber.y + rubber.h : rubber.y,
        w: Math.abs(rubber.w),
        h: Math.abs(rubber.h),
      };
      // Ignore a stray click that never became a drag.
      if (norm.w > GRID * 2 && norm.h > GRID * 2) {
        onDrawRect({ type: "rect", ...norm });
      }
      setRubber(null);
      return;
    }
    endDrag();
  };

  const finishPolygon = useCallback(() => {
    if (draft.length >= 3) onDrawPolygon(draft);
    setDraft([]);
  }, [draft, onDrawPolygon]);

  // Enter closes the polygon, Escape abandons it.
  useEffect(() => {
    if (tool !== "polygon") {
      setDraft([]);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") finishPolygon();
      if (e.key === "Escape") setDraft([]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tool, finishPolygon]);

  // Wheel zooms about the pointer, so the thing under the cursor stays put.
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const p = toLayout(e);
    const next = Math.min(8, Math.max(0.4, view.zoom * (e.deltaY < 0 ? 1.12 : 0.89)));
    const w = spec.bounds.width / next;
    const h = spec.bounds.height / next;
    const rect = wrapRef.current!.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    setView({ x: p.x - w * fx, y: p.y - h * fy, zoom: next });
  };

  const active = sectionOf(selected);
  const activeBox = active ? boundsOf(active.shape) : null;

  return (
    <div
      ref={wrapRef}
      className={cn(
        "relative touch-none overflow-hidden rounded-xl border border-border bg-subtle",
        className,
      )}
      style={{ aspectRatio: `${spec.bounds.width} / ${spec.bounds.height}` }}
      onWheel={onWheel}
    >
      <canvas
        ref={canvasRef}
        style={{ width: size.w, height: size.h }}
        className="pointer-events-none absolute inset-0"
        aria-hidden
      />

      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        className={cn(
          "absolute inset-0 h-full w-full",
          tool === "select" ? "cursor-default" : "cursor-crosshair",
        )}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) onSurfaceDown(e);
        }}
        onPointerMove={onSurfaceMove}
        onPointerUp={onSurfaceUp}
        onPointerCancel={onSurfaceUp}
      >
        <defs>
          <pattern
            id="grid"
            width={GRID * 5}
            height={GRID * 5}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${GRID * 5} 0 L 0 0 0 ${GRID * 5}`}
              fill="none"
              stroke="var(--border)"
              strokeWidth={1 / view.zoom}
            />
          </pattern>
        </defs>
        <rect
          x={vb.x}
          y={vb.y}
          width={vb.w}
          height={vb.h}
          fill="url(#grid)"
          onPointerDown={onSurfaceDown}
        />

        {spec.stage ? (
          <g aria-hidden pointerEvents="none">
            <path d={shapeToPath(spec.stage.shape)} className="fill-foreground" />
            <text
              x={boundsOf(spec.stage.shape).x + boundsOf(spec.stage.shape).w / 2}
              y={boundsOf(spec.stage.shape).y + boundsOf(spec.stage.shape).h / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-background font-bold"
              style={{ fontSize: 24 / view.zoom }}
            >
              {spec.stage.label}
            </text>
          </g>
        ) : null}

        {spec.sections.map((section) => {
          const isActive = section.key === selected;
          const box = boundsOf(section.shape);
          return (
            <g key={`sec-${section.key}`}>
              <path
                d={shapeToPath(section.shape)}
                fill={section.kind === "standing" ? section.color : "transparent"}
                fillOpacity={section.kind === "standing" ? 0.35 : 1}
                stroke={isActive ? "var(--accent)" : "var(--border-strong)"}
                strokeWidth={(isActive ? 3 : 1.5) / view.zoom}
                strokeDasharray={
                  section.kind === "standing" ? `${8 / view.zoom} ${6 / view.zoom}` : undefined
                }
                className={tool === "select" ? "cursor-move" : undefined}
                // A transparent fill still needs to be hittable.
                pointerEvents={tool === "select" ? "all" : "none"}
                onPointerDown={(e) => tool === "select" && startMove(e, section)}
              />
              <text
                x={box.x + box.w / 2}
                y={box.y - 8 / view.zoom}
                textAnchor="middle"
                pointerEvents="none"
                className={cn(
                  "font-bold",
                  isActive ? "fill-accent" : "fill-muted",
                )}
                style={{ fontSize: 18 / view.zoom }}
              >
                {section.name}
              </text>
            </g>
          );
        })}

        {/* Grips for the selected section */}
        {active && activeBox && tool === "select" ? (
          <g>
            {/* Rotate handle, on a stalk above the block. */}
            <line
              x1={activeBox.x + activeBox.w / 2}
              y1={activeBox.y}
              x2={activeBox.x + activeBox.w / 2}
              y2={activeBox.y - 34 / view.zoom}
              stroke="var(--accent)"
              strokeWidth={2 / view.zoom}
              pointerEvents="none"
            />
            <circle
              cx={activeBox.x + activeBox.w / 2}
              cy={activeBox.y - 34 / view.zoom}
              r={7 / view.zoom}
              className="fill-accent"
              style={{ cursor: "grab" }}
              onPointerDown={(e) => startRotate(e, active)}
            />

            {active.shape.type === "polygon"
              ? active.shape.points.map(([px, py], i) => (
                  <rect
                    key={`v-${i}`}
                    x={px - 6 / view.zoom}
                    y={py - 6 / view.zoom}
                    width={12 / view.zoom}
                    height={12 / view.zoom}
                    className="fill-background stroke-accent"
                    strokeWidth={2 / view.zoom}
                    style={{ cursor: "move" }}
                    onPointerDown={(e) => startVertex(e, active, i)}
                  />
                ))
              : HANDLES.map((h) => (
                  <rect
                    key={h.id}
                    x={activeBox.x + activeBox.w * h.fx - 6 / view.zoom}
                    y={activeBox.y + activeBox.h * h.fy - 6 / view.zoom}
                    width={12 / view.zoom}
                    height={12 / view.zoom}
                    className="fill-accent"
                    style={{ cursor: h.cursor }}
                    onPointerDown={(e) => startResize(e, active, h.id)}
                  />
                ))}
          </g>
        ) : null}

        {/* Rubber band for the rectangle tool */}
        {rubber ? (
          <rect
            x={rubber.w < 0 ? rubber.x + rubber.w : rubber.x}
            y={rubber.h < 0 ? rubber.y + rubber.h : rubber.y}
            width={Math.abs(rubber.w)}
            height={Math.abs(rubber.h)}
            className="fill-accent stroke-accent"
            fillOpacity={0.15}
            strokeWidth={2 / view.zoom}
            pointerEvents="none"
          />
        ) : null}

        {/* Polygon in progress */}
        {draft.length ? (
          <g pointerEvents="none">
            <polyline
              points={draft.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="var(--accent)"
              fillOpacity={0.12}
              stroke="var(--accent)"
              strokeWidth={2 / view.zoom}
            />
            {draft.map(([x, y], i) => (
              <circle
                key={`d-${i}`}
                cx={x}
                cy={y}
                r={5 / view.zoom}
                className="fill-accent"
              />
            ))}
          </g>
        ) : null}
      </svg>

      {/* Viewport readout + reset, so a lost operator can always get back. */}
      <div className="absolute bottom-2 end-2 flex items-center gap-2 rounded-lg bg-card/90 px-2 py-1 text-[11px] text-muted backdrop-blur">
        <span>{Math.round(view.zoom * 100)}٪</span>
        <button
          type="button"
          onClick={() => setView({ x: 0, y: 0, zoom: 1 })}
          className="rounded px-1.5 py-0.5 hover:bg-subtle"
        >
          بازنشانی نما
        </button>
      </div>

      {tool === "polygon" && draft.length >= 3 ? (
        <button
          type="button"
          onClick={finishPolygon}
          className="absolute bottom-2 start-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground shadow"
        >
          بستن چندضلعی (Enter)
        </button>
      ) : null}
    </div>
  );
}
