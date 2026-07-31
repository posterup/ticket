"use client";

/**
 * Designer state and history.
 *
 * A reducer over one `LayoutSpec`. Every mutation produces a whole new spec and
 * pushes the previous one onto an undo stack — specs are kilobytes (sections
 * declare row *generators*, not enumerated seats), so snapshotting is cheaper
 * and far less bug-prone than inverse operations.
 *
 * **Gestures are one undo step.** A drag fires a mutation on every pointer-move;
 * without `beginGesture`/`endGesture` a single drag would push fifty history
 * entries and undo would step the section back one pixel at a time. The gesture
 * pushes history once, at the start, and every frame after that replaces the
 * spec in place.
 *
 * Geometry lives in `lib/venues/transform.ts`, not here, so the canvas can use
 * the same functions for its live preview — what you drag is what gets stored.
 */

import {
  emptyLayoutSpec,
  type LayoutSpec,
  type SectionShape,
  type SectionSpec,
} from "@/types";
import {
  mirrorSection,
  moveSection,
  resizeSection,
  rotateSection,
} from "@/lib/venues/transform";
import { type Box, boundsOf, translateShape } from "@/lib/venues/geometry";

const HISTORY_LIMIT = 50;

export interface DesignerState {
  spec: LayoutSpec;
  selected: string | null;
  past: LayoutSpec[];
  future: LayoutSpec[];
  dirty: boolean;
  /** True between beginGesture and endGesture; suppresses history pushes. */
  gesture: boolean;
}

export type DesignerAction =
  | { type: "load"; spec: LayoutSpec }
  | { type: "select"; key: string | null }
  | { type: "beginGesture" }
  | { type: "endGesture" }
  | { type: "addSection"; section: SectionSpec }
  | { type: "updateSection"; key: string; patch: Partial<SectionSpec> }
  | { type: "replaceSection"; key: string; section: SectionSpec }
  | { type: "removeSection"; key: string }
  | { type: "move"; key: string; dx: number; dy: number }
  | { type: "resize"; key: string; box: Box }
  | { type: "rotate"; key: string; deg: number }
  | { type: "mirror"; key: string; axis: "horizontal" | "vertical" }
  | { type: "duplicate"; key: string }
  | { type: "setStage"; shape: SectionShape }
  | { type: "setBounds"; width: number; height: number }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "saved" };

export function initialState(spec?: LayoutSpec): DesignerState {
  return {
    spec: spec ?? emptyLayoutSpec(),
    selected: null,
    past: [],
    future: [],
    dirty: false,
    gesture: false,
  };
}

/**
 * Install a new spec.
 *
 * Mid-gesture the history was already pushed by `beginGesture`, so this only
 * swaps the spec — that is what collapses a whole drag into one undo step.
 */
function commit(state: DesignerState, next: LayoutSpec): DesignerState {
  if (state.gesture) return { ...state, spec: next, dirty: true };
  return {
    ...state,
    spec: next,
    past: [...state.past, state.spec].slice(-HISTORY_LIMIT),
    future: [],
    dirty: true,
  };
}

function mapSection(
  spec: LayoutSpec,
  key: string,
  fn: (section: SectionSpec) => SectionSpec,
): LayoutSpec {
  return {
    ...spec,
    sections: spec.sections.map((s) => (s.key === key ? fn(s) : s)),
  };
}

/** `stalls` → `stalls-2`, `stalls-3`, … Keys must stay unique within a spec. */
function uniqueKey(spec: LayoutSpec, base: string): string {
  const stem = base.replace(/-\d+$/, "");
  const taken = new Set(spec.sections.map((s) => s.key));
  let n = 2;
  while (taken.has(`${stem}-${n}`)) n += 1;
  return `${stem}-${n}`;
}

export function designerReducer(
  state: DesignerState,
  action: DesignerAction,
): DesignerState {
  switch (action.type) {
    case "load":
      return initialState(action.spec);

    case "select":
      return { ...state, selected: action.key };

    case "beginGesture":
      // Push once, up front. Everything until endGesture replaces in place.
      return {
        ...state,
        gesture: true,
        past: [...state.past, state.spec].slice(-HISTORY_LIMIT),
        future: [],
      };

    case "endGesture":
      return { ...state, gesture: false };

    case "addSection":
      return {
        ...commit(state, {
          ...state.spec,
          sections: [...state.spec.sections, action.section],
        }),
        selected: action.section.key,
      };

    case "updateSection":
      return commit(
        state,
        mapSection(state.spec, action.key, (s) => ({ ...s, ...action.patch })),
      );

    case "replaceSection":
      return commit(
        state,
        mapSection(state.spec, action.key, () => action.section),
      );

    case "removeSection":
      return {
        ...commit(state, {
          ...state.spec,
          sections: state.spec.sections.filter((s) => s.key !== action.key),
        }),
        selected: null,
      };

    case "move":
      return commit(
        state,
        mapSection(state.spec, action.key, (s) =>
          moveSection(s, action.dx, action.dy),
        ),
      );

    case "resize":
      return commit(
        state,
        mapSection(state.spec, action.key, (s) => resizeSection(s, action.box)),
      );

    case "rotate":
      return commit(
        state,
        mapSection(state.spec, action.key, (s) => rotateSection(s, action.deg)),
      );

    case "mirror":
      return commit(
        state,
        mapSection(state.spec, action.key, (s) =>
          mirrorSection(s, action.axis, state.spec.bounds),
        ),
      );

    case "duplicate": {
      const source = state.spec.sections.find((s) => s.key === action.key);
      if (!source) return state;
      const key = uniqueKey(state.spec, source.key);
      const copy: SectionSpec = {
        ...moveSection(source, 40, 40),
        key,
        name: `${source.name} (کپی)`,
      };
      return {
        ...commit(state, {
          ...state.spec,
          sections: [...state.spec.sections, copy],
        }),
        selected: key,
      };
    }

    case "setStage":
      return commit(state, {
        ...state.spec,
        stage: { label: state.spec.stage?.label ?? "صحنه", shape: action.shape },
      });

    case "setBounds":
      return commit(state, {
        ...state.spec,
        bounds: { width: action.width, height: action.height },
      });

    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        ...state,
        spec: previous,
        past: state.past.slice(0, -1),
        future: [state.spec, ...state.future].slice(0, HISTORY_LIMIT),
        dirty: true,
      };
    }

    case "redo": {
      const [next, ...rest] = state.future;
      if (!next) return state;
      return {
        ...state,
        spec: next,
        past: [...state.past, state.spec].slice(-HISTORY_LIMIT),
        future: rest,
        dirty: true,
      };
    }

    case "saved":
      return { ...state, dirty: false };

    default:
      return state;
  }
}

/** A fresh block, dropped at the centre of the canvas. */
export function newSection(
  spec: LayoutSpec,
  kind: SectionSpec["kind"],
  shape?: SectionShape,
): SectionSpec {
  const key = uniqueKey(spec, kind === "standing" ? "standing" : "section");
  const resolved: SectionShape =
    shape ??
    {
      type: "rect",
      x: spec.bounds.width / 2 - 160,
      y: spec.bounds.height / 2 - 100,
      w: 320,
      h: 200,
    };
  const box = boundsOf(resolved);

  return {
    key,
    name: kind === "standing" ? "بخش ایستاده" : "بخش تازه",
    kind,
    shape: resolved,
    color: "#1b6df5",
    tier: 2,
    ...(kind === "standing"
      ? { capacity: 200 }
      : {
          rows: {
            count: 6,
            spacing: Math.max(12, box.h / 8),
            seatSpacing: Math.max(12, box.w / 14),
            origin: [box.x + box.w / 2, box.y + box.h / 8],
            angle: 0,
            curve: 0,
            seatsPerRow: 10,
            numbering: {
              rowScheme: "latin" as const,
              rowDirection: "front-to-back" as const,
              seatScheme: "sequential" as const,
              seatStart: 1,
              seatOrigin: "right" as const,
              skip: [],
            },
          },
        }),
  };
}

/** A stage block sized to the layout, for the "place stage" tool. */
export function stageShapeAt(x: number, y: number): SectionShape {
  return { type: "rect", x: x - 180, y: y - 32, w: 360, h: 64 };
}

export { translateShape };
