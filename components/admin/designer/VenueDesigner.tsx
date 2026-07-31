"use client";

/**
 * The venue designer.
 *
 * Loaded through `next/dynamic({ ssr: false })` by its page — it measures the
 * DOM and touches canvas on mount, the same reason `LocationPicker` defers
 * Leaflet.
 *
 * Save and publish are deliberately separate verbs. Saving is cheap and
 * frequent and touches nothing on sale; publishing compiles a new immutable
 * version, and sessions already pointing at an older one keep it — that is what
 * stops a renovation from rewriting the seat printed on a sold ticket.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { apiFetch, ApiCallError } from "@/lib/client/api";
import { formatNumber } from "@/lib/format";
import { totalSeats, validateSpec } from "@/lib/venues/spec";
import { boundsOf } from "@/lib/venues/geometry";
import { Button } from "@/components/ui/button";
import type { LayoutSpec } from "@/types";

import { DesignerCanvas, type Tool } from "./DesignerCanvas";
import { Inspector } from "./Inspector";
import {
  designerReducer,
  initialState,
  newSection,
  stageShapeAt,
  type DesignerState,
} from "./reducer";

interface LayoutDetail {
  layoutId: string;
  venueId: string;
  venueName: string;
  draft: LayoutSpec;
  publishedVersionId?: string;
  versions: { id: string; version: number; totalSeats: number; publishedAt: string }[];
}

export function VenueDesigner({ layout }: { layout: LayoutDetail }) {
  const [state, dispatch] = useReducer(
    designerReducer,
    layout.draft,
    initialState as (spec: LayoutSpec) => DesignerState,
  );
  const [tool, setTool] = useState<Tool>("select");
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  const selected = state.spec.sections.find((s) => s.key === state.selected);
  const seats = totalSeats(state.spec);

  // The keyboard handler is installed once; a ref keeps it reading the current
  // selection without re-binding the listener on every selection change.
  const selectedKey = useRef<string | null>(null);
  selectedKey.current = state.selected;

  /**
   * Keyboard. Ignored while typing in the inspector, so the browser's own text
   * editing and undo keep working.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      if (e.metaKey || e.ctrlKey) {
        if (e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          dispatch({ type: "undo" });
        } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
          e.preventDefault();
          dispatch({ type: "redo" });
        }
        return;
      }

      // Tool shortcuts, in the order a designer reaches for them.
      if (e.key === "v") setTool("select");
      if (e.key === "r") setTool("rect");
      if (e.key === "p") setTool("polygon");
      if (e.key === "Escape") {
        setTool("select");
        dispatch({ type: "select", key: null });
      }

      if (!selectedKey.current) return;
      const key = selectedKey.current;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        dispatch({ type: "removeSection", key });
        return;
      }

      // Arrow nudge: 1 grid step, 10 with shift. One undo entry per burst is
      // not worth the bookkeeping — each press is a discrete edit.
      const step = e.shiftKey ? 100 : 10;
      const nudge: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const delta = nudge[e.key];
      if (delta) {
        e.preventDefault();
        dispatch({ type: "move", key, dx: delta[0], dy: delta[1] });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const save = useCallback(async () => {
    setBusy("save");
    setMessage(null);
    setProblems([]);
    try {
      await apiFetch(`/api/admin/venues/${layout.venueId}/layout`, {
        method: "PATCH",
        body: JSON.stringify({ draft: state.spec }),
      });
      dispatch({ type: "saved" });
      setMessage("پیش‌نویس ذخیره شد.");
    } catch (error) {
      setMessage(
        error instanceof ApiCallError ? error.message : "ذخیره ناموفق بود.",
      );
    } finally {
      setBusy(null);
    }
  }, [layout.venueId, state.spec]);

  const publish = useCallback(async () => {
    // Checked here as well as server-side so the operator gets the list before
    // a round trip, not after.
    const local = validateSpec(state.spec);
    if (local.length) {
      setProblems(local.map((p) => p.message));
      setMessage(null);
      return;
    }

    setBusy("publish");
    setMessage(null);
    setProblems([]);
    try {
      await apiFetch(`/api/admin/venues/${layout.venueId}/layout`, {
        method: "PATCH",
        body: JSON.stringify({ draft: state.spec }),
      });
      const result = await apiFetch<{ version: number; totalSeats: number }>(
        `/api/admin/venues/${layout.venueId}/layout/publish`,
        { method: "POST" },
      );
      dispatch({ type: "saved" });
      setMessage(
        `نسخه ${formatNumber(result.version)} منتشر شد — ${formatNumber(result.totalSeats)} صندلی.`,
      );
    } catch (error) {
      if (error instanceof ApiCallError) setMessage(error.message);
      else setMessage("انتشار ناموفق بود.");
    } finally {
      setBusy(null);
    }
  }, [layout.venueId, state.spec]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {layout.venueName}
          </h1>
          <p className="text-xs text-muted">
            {formatNumber(state.spec.sections.length)} بخش ·{" "}
            {formatNumber(seats)} صندلی
            {state.dirty ? " · ذخیره‌نشده" : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={!state.past.length}
            onClick={() => dispatch({ type: "undo" })}
          >
            واگرد
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!state.future.length}
            onClick={() => dispatch({ type: "redo" })}
          >
            ازنو
          </Button>
          <Button size="sm" variant="secondary" disabled={busy !== null} onClick={save}>
            {busy === "save" ? "در حال ذخیره…" : "ذخیره پیش‌نویس"}
          </Button>
          <Button size="sm" disabled={busy !== null} onClick={publish}>
            {busy === "publish" ? "در حال انتشار…" : "انتشار نسخه"}
          </Button>
        </div>
      </header>

      {message ? (
        <p role="status" className="rounded-lg bg-subtle px-3 py-2 text-sm text-foreground">
          {message}
        </p>
      ) : null}

      {problems.length ? (
        <ul className="rounded-lg bg-accent-soft px-4 py-3 text-sm text-accent-text">
          {problems.map((p) => (
            <li key={p} className="list-inside list-disc">
              {p}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Tool palette. Shortcuts match the canvas keyboard handler. */}
      <div role="toolbar" aria-label="ابزارها" className="flex flex-wrap gap-2">
        {(
          [
            { id: "select", label: "انتخاب", hint: "V" },
            { id: "rect", label: "بخش مستطیل", hint: "R" },
            { id: "polygon", label: "بخش چندضلعی", hint: "P" },
            { id: "stage", label: "جای‌گذاری صحنه", hint: "" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tool === t.id}
            onClick={() => setTool(t.id)}
            className={
              tool === t.id
                ? "rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground"
                : "rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:border-accent"
            }
          >
            {t.label}
            {t.hint ? <span className="ms-1.5 text-[11px] opacity-70">{t.hint}</span> : null}
          </button>
        ))}
        <span className="self-center text-[11px] text-faint">
          کشیدن برای جابه‌جایی · دستگیره‌ها برای تغییر اندازه · چرخ ماوس برای بزرگ‌نمایی · Alt+کشیدن برای حرکت نما
        </span>
      </div>

      <div className="flex flex-col gap-4 xl:flex-row">
        <DesignerCanvas
          spec={state.spec}
          selected={state.selected}
          tool={tool}
          onSelect={(key) => dispatch({ type: "select", key })}
          onBeginGesture={() => dispatch({ type: "beginGesture" })}
          onEndGesture={() => dispatch({ type: "endGesture" })}
          onReplace={(key, section) =>
            dispatch({ type: "replaceSection", key, section })
          }
          onDrawRect={(shape) => {
            dispatch({
              type: "addSection",
              section: newSection(state.spec, "seated", shape),
            });
            setTool("select");
          }}
          onDrawPolygon={(points) => {
            dispatch({
              type: "addSection",
              section: newSection(state.spec, "seated", {
                type: "polygon",
                points,
              }),
            });
            setTool("select");
          }}
          onPlaceStage={(x, y) => {
            dispatch({ type: "setStage", shape: stageShapeAt(x, y) });
            setTool("select");
          }}
          className="flex-1"
        />

        <aside className="w-full shrink-0 rounded-xl border border-border bg-card p-4 xl:max-w-sm">
          {selected ? (
            <Inspector
              section={selected}
              onChange={(patch) =>
                dispatch({ type: "updateSection", key: selected.key, patch })
              }
              onRemove={() =>
                dispatch({ type: "removeSection", key: selected.key })
              }
              onDuplicate={() =>
                dispatch({ type: "duplicate", key: selected.key })
              }
              onMirror={(axis) =>
                dispatch({ type: "mirror", key: selected.key, axis })
              }
              onRotate={(deg) =>
                dispatch({ type: "rotate", key: selected.key, deg })
              }
              onResize={(sx, sy) => {
                const box = boundsOf(selected.shape);
                dispatch({
                  type: "resize",
                  key: selected.key,
                  box: {
                    x: box.x + (box.w * (1 - sx)) / 2,
                    y: box.y + (box.h * (1 - sy)) / 2,
                    w: box.w * sx,
                    h: box.h * sy,
                  },
                });
              }}
            />
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-muted">
                یک بخش را از نقشه انتخاب کنید،
              </p>
              <p className="mt-1 text-sm text-muted">
                یا بخش تازه‌ای بسازید.
              </p>
            </div>
          )}
        </aside>
      </div>

      {layout.versions.length ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-bold text-foreground">
            نسخه‌های منتشرشده
          </h2>
          <ul className="flex flex-col gap-1 text-xs text-muted">
            {layout.versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between">
                <span>
                  نسخه {formatNumber(v.version)}
                  {v.id === layout.publishedVersionId ? " (فعال)" : ""}
                </span>
                <span>{formatNumber(v.totalSeats)} صندلی</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-faint">
            سانس‌هایی که به نسخه‌های قبلی وصل‌اند، همان نسخه را نگه می‌دارند؛ انتشار
            نسخه تازه بلیت‌های فروخته‌شده را تغییر نمی‌دهد.
          </p>
        </section>
      ) : null}
    </div>
  );
}
