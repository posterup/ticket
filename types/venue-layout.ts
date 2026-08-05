/**
 * Venue layout — the seat-map domain.
 *
 * Three vocabularies live here and are deliberately kept apart:
 *
 * * `LayoutSpec` is the *authoring* format. It is what the admin designer edits
 *   and what a published version freezes. Sections declare a row *generator*
 *   rather than enumerated seats, so a 50,000-seat stadium is a few kilobytes.
 * * `VenueOverview` is the *orientation* payload. It carries no seats at all —
 *   only section shapes — and is immutable per layout version.
 * * `SectionSeats` is the *columnar* seat artifact for one section, fetched only
 *   once a customer drills into it.
 *
 * Geometry never travels with availability. Geometry is addressed by version id
 * and cached forever; availability is a separate, tiny, short-lived payload.
 * That split is the reason this scales.
 */

import type { Money } from "./api";

/** Layout coordinates are unitless and resolved against `LayoutBounds`. */
export interface Point {
  x: number;
  y: number;
}

export interface LayoutBounds {
  width: number;
  height: number;
}

// ───────────────────────────── shapes ─────────────────────────────

export interface RectShape {
  type: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  /** Degrees, clockwise, about the rectangle's centre. */
  rotation?: number;
}

export interface PolygonShape {
  type: "polygon";
  points: [number, number][];
}

/**
 * A ring segment — the classic fan-shaped seating bowl.
 *
 * Authoring is supported and it renders, but the seat generator does not yet
 * lay rows along the arc: `generateSection` falls back to straight rows inside
 * the arc's bounding box. See `docs/venue-architecture.md`.
 */
export interface ArcShape {
  type: "arc";
  cx: number;
  cy: number;
  rInner: number;
  rOuter: number;
  /** Degrees. 0 points along +x, increasing clockwise. */
  startAngle: number;
  endAngle: number;
}

export type SectionShape = RectShape | PolygonShape | ArcShape;

// ───────────────────────────── numbering ─────────────────────────────

export type RowScheme = "latin" | "numeric" | "persian-alpha" | "custom";
export type RowDirection = "front-to-back" | "back-to-front";
export type SeatScheme = "sequential" | "odd-even" | "block";
/**
 * Which end of the row holds the first seat.
 *
 * Authored, never inferred. Iranian venues disagree with each other about this
 * and an RTL document direction does not settle it.
 */
export type SeatOrigin = "left" | "right";

export interface NumberingSpec {
  rowScheme: RowScheme;
  /** Used when `rowScheme` is "custom"; indexed by row ordinal. */
  rowLabels?: string[];
  rowDirection: RowDirection;
  seatScheme: SeatScheme;
  seatStart: number;
  seatOrigin: SeatOrigin;
  /** Numbers skipped by convention — 13 here, 4 in parts of east Asia. */
  skip?: number[];
}

export const DEFAULT_NUMBERING: NumberingSpec = {
  rowScheme: "latin",
  rowDirection: "front-to-back",
  seatScheme: "sequential",
  seatStart: 1,
  seatOrigin: "right",
  skip: [],
};

// ───────────────────────────── seats ─────────────────────────────

export type SeatKind =
  | "standard"
  | "wheelchair"
  | "companion"
  | "obstructed"
  | "house";

/** Wire encoding for `SeatKind`, by index. Columnar payloads send the ordinal. */
export const SEAT_KINDS: readonly SeatKind[] = [
  "standard",
  "wheelchair",
  "companion",
  "obstructed",
  "house",
] as const;

export type SectionKind = "seated" | "standing";

/** Sparse, keyed by section-local seat index. */
export interface SeatOverride {
  kind?: SeatKind;
  label?: string;
  /** Nudge from the generated position. */
  dx?: number;
  dy?: number;
}

// ───────────────────────────── the spec ─────────────────────────────

export interface RowGenerator {
  count: number;
  /** Distance between consecutive rows, along the section's normal. */
  spacing: number;
  /** Distance between consecutive seats, along the row. */
  seatSpacing: number;
  /** First seat of the first row. */
  origin: [number, number];
  /** Row direction in degrees. 0 lays seats along +x. */
  angle: number;
  /**
   * Bow, as a fraction of row length. 0 is straight; positive bows away from
   * the stage. Applied as a quadratic offset — cheap and close enough.
   */
  curve: number;
  /** Per-row seat counts. A single value applies to every row. */
  seatsPerRow: number[] | number;
  numbering: NumberingSpec;
}

export interface SectionSpec {
  key: string;
  name: string;
  kind: SectionKind;
  shape: SectionShape;
  /** A design token name (`accent`, `success`, …) or a hex value. */
  color: string;
  /** Authored proximity tier; 1 is closest to the stage. Never a distance. */
  tier: number;
  labelAt?: [number, number];
  /** Absent for `standing` sections, which have capacity but no seats. */
  rows?: RowGenerator;
  /** Authoritative for `standing`; derived from `rows` for `seated`. */
  capacity?: number;
  overrides?: Record<string, SeatOverride>;
}

export interface StageSpec {
  shape: SectionShape;
  label: string;
}

export interface LayoutSpec {
  /** Spec format revision, for future migrations. Not the published version. */
  version: number;
  bounds: LayoutBounds;
  stage?: StageSpec;
  sections: SectionSpec[];
}

export const LAYOUT_SPEC_VERSION = 1;

export function emptyLayoutSpec(): LayoutSpec {
  return {
    version: LAYOUT_SPEC_VERSION,
    bounds: { width: 1200, height: 900 },
    stage: {
      shape: { type: "rect", x: 420, y: 40, w: 360, h: 64 },
      label: "صحنه",
    },
    sections: [],
  };
}

// ───────────────────────── generated seats ─────────────────────────

export interface GeneratedSeat {
  /** Section-local ordinal. The wire identity — uuids never reach the client. */
  index: number;
  rowKey: string;
  label: string;
  x: number;
  y: number;
  kind: SeatKind;
}

export interface GeneratedRow {
  key: string;
  label: string;
  index: number;
  seatCount: number;
}

export interface GeneratedSection {
  key: string;
  rows: GeneratedRow[];
  seats: GeneratedSeat[];
}

// ───────────────────────────── wire: overview ─────────────────────────────

export type AvailabilityIndicator =
  | "available"
  | "limited"
  | "almost-full"
  | "sold-out";

/** Immutable half of a section, addressed by layout version. */
export interface OverviewSection {
  key: string;
  name: string;
  kind: SectionKind;
  shape: SectionShape;
  color: string;
  tier: number;
  labelAt: [number, number];
  /** Total seats (or standing capacity). Not availability. */
  capacity: number;
}

export interface VenueOverview {
  versionId: string;
  venueName: string;
  bounds: LayoutBounds;
  stage?: StageSpec;
  sections: OverviewSection[];
  totalSeats: number;
  /**
   * Below this the client skips the drill-in step and renders seats straight
   * away — a 200-seat cinema does not benefit from a two-step map.
   */
  directRenderThreshold: number;
}

/** Volatile half. Fetched separately, never cached at the edge. */
export interface SectionAvailability {
  key: string;
  available: number;
  indicator: AvailabilityIndicator;
  priceFrom?: Money;
  ticketTypeId?: string;
}

/**
 * Named `…Snapshot` rather than `SessionAvailability`, which `types/event.ts`
 * already uses for the coarse full/almost-full badge on a session card.
 */
export interface SessionAvailabilitySnapshot {
  sessionId: string;
  sections: SectionAvailability[];
  /** Server clock, so clients can age the numbers honestly. */
  asOf: string;
}

// ───────────────────────────── wire: seats ─────────────────────────────

/**
 * Columnar on purpose. `[{x,y,label,kind}, …] × 5000` is mostly repeated JSON
 * keys; parallel arrays cut the payload by roughly half before compression and
 * decode straight into typed arrays.
 */
export interface SectionSeats {
  key: string;
  count: number;
  rows: { key: string; label: string; from: number; count: number }[];
  x: number[];
  y: number[];
  label: string[];
  /** Index into `SEAT_KINDS`. */
  kind: number[];
}

/** Section-local indices. Absence means available. */
export interface SectionStatus {
  key: string;
  sold: number[];
  held: number[];
  /**
   * Seats the venue keeps back — press, technical holds, accessibility
   * companions reserved by the box office. Never sellable, and distinct from
   * `sold`: nobody bought them, and they will not free up.
   */
  blocked: number[];
  asOf: string;
}

// ───────────────────────────── holds ─────────────────────────────

export interface SeatSelection {
  section: string;
  seats: number[];
}

export interface HoldResult {
  sessionId: string;
  section: string;
  /** Indices actually acquired. */
  acquired: number[];
  /** Indices lost to someone else, if the request was partial. */
  rejected: number[];
  expiresAt: string;
}

/**
 * A standing (general-admission) choice.
 *
 * Standing sections have capacity but no seats, so they are bought by the
 * ticket rather than by position — a quantity against the section's ticket
 * type, which the order flow sends as an ordinary line item.
 */
export interface StandingSelection {
  section: string;
  sectionName: string;
  ticketTypeId: string;
  quantity: number;
  price?: Money;
}

/** One seat's worth of detail, for the accessible list and the order summary. */
export interface SeatDetail {
  index: number;
  section: string;
  sectionName: string;
  rowLabel: string;
  seatLabel: string;
  kind: SeatKind;
  price?: Money;
}
