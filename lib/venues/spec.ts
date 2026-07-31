/**
 * Compiling a `LayoutSpec` into concrete seats.
 *
 * This is the bridge between what the designer authors — a row *generator* — and
 * what the database materialises at publish. Both the live editor preview and
 * the publish step call `generateSection`, so what an operator sees is exactly
 * what gets sold.
 *
 * Pure: no database, no clock, no randomness. `tests/venue-spec.test.ts` runs it
 * without a `DATABASE_URL`.
 */

import type {
  GeneratedSection,
  GeneratedSeat,
  LayoutSpec,
  SectionSeats,
  SectionSpec,
  VenueOverview,
} from "@/types";
import { DEFAULT_NUMBERING, SEAT_KINDS } from "@/types";

import { formatNumber } from "@/lib/format";

import { boundsOf, centroidOf } from "./geometry";
import { rowLabelsForSection, seatLabelsForRow } from "./numbering";

/**
 * Below this many seats the customer map skips the drill-in step entirely.
 *
 * A 200-seat cinema gains nothing from a two-step map — the extra tap costs
 * more than the render it avoids. See `docs/venue-architecture.md` §13.
 */
export const DIRECT_RENDER_THRESHOLD = 600;

/** Hard ceiling per section, so a fat-fingered generator cannot wedge publish. */
export const MAX_SEATS_PER_SECTION = 20_000;

function seatsPerRow(gen: SectionSpec["rows"], rowIndex: number): number {
  if (!gen) return 0;
  const spr = gen.seatsPerRow;
  if (typeof spr === "number") return spr;
  return spr[rowIndex] ?? spr[spr.length - 1] ?? 0;
}

/**
 * Seats for one section, in row-major order.
 *
 * Rows are laid along `angle`; successive rows step along the perpendicular.
 * `curve` bows the row as a quadratic in the normalised position across it,
 * which is visually indistinguishable from a true arc at the radii real venues
 * use and far cheaper to invert for hit-testing.
 */
export function generateSection(section: SectionSpec): GeneratedSection {
  const gen = section.rows;
  if (!gen || section.kind === "standing") {
    return { key: section.key, rows: [], seats: [] };
  }

  const numbering = { ...DEFAULT_NUMBERING, ...gen.numbering };
  const rowLabels = rowLabelsForSection(numbering, gen.count);
  const theta = (gen.angle * Math.PI) / 180;
  const along = { x: Math.cos(theta), y: Math.sin(theta) };
  const normal = { x: -Math.sin(theta), y: Math.cos(theta) };

  const rows: GeneratedSection["rows"] = [];
  const seats: GeneratedSeat[] = [];
  let index = 0;

  for (let r = 0; r < gen.count; r += 1) {
    const count = seatsPerRow(gen, r);
    if (count <= 0) continue;
    if (seats.length + count > MAX_SEATS_PER_SECTION) break;

    const label = rowLabels[r] ?? String(r + 1);
    const seatLabels = seatLabelsForRow(numbering, count);

    // Centre each row on the generator origin so rows of differing widths stay
    // aligned about the section's axis rather than flush to one edge.
    const width = (count - 1) * gen.seatSpacing;
    const baseX = gen.origin[0] + normal.x * (r * gen.spacing);
    const baseY = gen.origin[1] + normal.y * (r * gen.spacing);

    rows.push({ key: label, label, index: r, seatCount: count });

    for (let s = 0; s < count; s += 1) {
      const offset = s * gen.seatSpacing - width / 2;
      // t ∈ [-1, 1] across the row; the bow peaks at the middle.
      const t = count > 1 ? (s / (count - 1)) * 2 - 1 : 0;
      const bow = gen.curve * width * (1 - t * t) * 0.5;

      const x = baseX + along.x * offset + normal.x * bow;
      const y = baseY + along.y * offset + normal.y * bow;

      const override = section.overrides?.[String(index)];
      seats.push({
        index,
        rowKey: label,
        label: override?.label ?? seatLabels[s] ?? String(s + 1),
        x: x + (override?.dx ?? 0),
        y: y + (override?.dy ?? 0),
        kind: override?.kind ?? "standard",
      });
      index += 1;
    }
  }

  return { key: section.key, rows, seats };
}

/** Total sellable units — seats for seated sections, capacity for standing. */
export function sectionCapacity(section: SectionSpec): number {
  if (section.kind === "standing") return section.capacity ?? 0;
  return generateSection(section).seats.length;
}

export function totalSeats(spec: LayoutSpec): number {
  return spec.sections.reduce((sum, s) => sum + sectionCapacity(s), 0);
}

/**
 * The columnar wire artifact for one section.
 *
 * Rounded to one decimal: sub-pixel precision is invisible at any zoom a
 * customer reaches, and trimming it is a free ~15% off the payload.
 */
export function toSectionSeats(generated: GeneratedSection): SectionSeats {
  const { seats, rows, key } = generated;
  const rowSpans: SectionSeats["rows"] = [];

  let cursor = 0;
  for (const row of rows) {
    rowSpans.push({
      key: row.key,
      label: row.label,
      from: cursor,
      count: row.seatCount,
    });
    cursor += row.seatCount;
  }

  return {
    key,
    count: seats.length,
    rows: rowSpans,
    x: seats.map((s) => Math.round(s.x * 10) / 10),
    y: seats.map((s) => Math.round(s.y * 10) / 10),
    label: seats.map((s) => s.label),
    kind: seats.map((s) => SEAT_KINDS.indexOf(s.kind)),
  };
}

/** The immutable orientation payload. Carries no seats by construction. */
export function toOverview(
  spec: LayoutSpec,
  meta: { versionId: string; venueName: string },
): VenueOverview {
  return {
    versionId: meta.versionId,
    venueName: meta.venueName,
    bounds: spec.bounds,
    stage: spec.stage,
    sections: spec.sections.map((s) => {
      const at = s.labelAt ?? centroidOf(s.shape);
      return {
        key: s.key,
        name: s.name,
        kind: s.kind,
        shape: s.shape,
        color: s.color,
        tier: s.tier,
        labelAt: Array.isArray(at)
          ? (at as [number, number])
          : [at.x, at.y],
        capacity: sectionCapacity(s),
      };
    }),
    totalSeats: totalSeats(spec),
    directRenderThreshold: DIRECT_RENDER_THRESHOLD,
  };
}

// ───────────────────────────── validation ─────────────────────────────

export interface SpecProblem {
  path: string;
  message: string;
}

/**
 * Structural validation, run before publish.
 *
 * Deliberately not zod: the messages are operator-facing Persian and the checks
 * are cross-field (duplicate keys, overlapping ids, empty sections), which read
 * far worse as a schema than as straight code.
 */
export function validateSpec(spec: LayoutSpec): SpecProblem[] {
  const problems: SpecProblem[] = [];

  if (spec.bounds.width <= 0 || spec.bounds.height <= 0) {
    problems.push({ path: "bounds", message: "ابعاد سالن باید مثبت باشد." });
  }
  if (!spec.sections.length) {
    problems.push({ path: "sections", message: "حداقل یک بخش لازم است." });
  }

  const seen = new Set<string>();
  for (const [i, section] of spec.sections.entries()) {
    const at = `sections[${i}]`;

    if (!section.key.trim()) {
      problems.push({ path: at, message: "شناسه بخش نمی‌تواند خالی باشد." });
    } else if (seen.has(section.key)) {
      problems.push({
        path: at,
        message: `شناسه بخش «${section.key}» تکراری است.`,
      });
    }
    seen.add(section.key);

    if (!section.name.trim()) {
      problems.push({ path: at, message: "نام بخش لازم است." });
    }

    if (section.kind === "standing") {
      if (!section.capacity || section.capacity <= 0) {
        problems.push({
          path: at,
          message: `ظرفیت بخش ایستاده «${section.name}» باید مثبت باشد.`,
        });
      }
      continue;
    }

    if (!section.rows) {
      problems.push({
        path: at,
        message: `بخش «${section.name}» هیچ ردیفی ندارد.`,
      });
      continue;
    }

    const count = generateSection(section).seats.length;
    if (count === 0) {
      problems.push({
        path: at,
        message: `بخش «${section.name}» هیچ صندلی تولید نمی‌کند.`,
      });
    }
    if (count >= MAX_SEATS_PER_SECTION) {
      problems.push({
        path: at,
        message: `بخش «${section.name}» از سقف ${formatNumber(MAX_SEATS_PER_SECTION)} صندلی گذشت.`,
      });
    }

    const box = boundsOf(section.shape);
    if (box.w <= 0 || box.h <= 0) {
      problems.push({
        path: at,
        message: `شکل بخش «${section.name}» نامعتبر است.`,
      });
    }
  }

  return problems;
}
