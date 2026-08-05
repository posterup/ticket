/**
 * Row and seat numbering.
 *
 * Pure and deterministic: the same spec always produces the same labels in the
 * same order. That matters more than it looks — published layouts materialise
 * seats once, but the designer regenerates on every keystroke, and a label that
 * drifts between the two would rename seats on already-sold tickets.
 *
 * Labels are produced in ASCII. Persian digits are a rendering concern, applied
 * with `formatNumber()` at the edge, so sorting, search and door-scanning keep
 * working on the stored value.
 */

import type { NumberingSpec, RowScheme } from "@/types";

/** Persian alphabet as used for theatre rows — the short, conventional run. */
const PERSIAN_ROW_LETTERS = [
  "الف", "ب", "پ", "ت", "ث", "ج", "چ", "ح", "خ", "د",
  "ذ", "ر", "ز", "ژ", "س", "ش", "ص", "ض", "ط", "ظ",
  "ع", "غ", "ف", "ق", "ک", "گ", "ل", "م", "ن", "و",
  "ه", "ی",
];

/**
 * Spreadsheet-style: A…Z, then AA…AZ, BA…
 *
 * Deliberately not base-26 arithmetic — that yields a "Z → BA" gap because
 * there is no zero digit in this alphabet.
 */
export function latinRowLabel(index: number): string {
  let n = index;
  let label = "";
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

export function persianRowLabel(index: number): string {
  const letters = PERSIAN_ROW_LETTERS;
  if (index < letters.length) return letters[index];
  /**
   * Past the alphabet, repeat with a numeric suffix: `الف2`, `ب2` …
   *
   * An **ASCII** 2, matching every other label this module emits — see the note
   * at the top. Written as «الف۲» here once, which read as a spec for Persian
   * digits rather than a description of the rendered output, and would have
   * talked someone into "fixing" the code to match: stored labels are what the
   * door scanner compares and what row search sorts on, and a Persian digit in
   * that string breaks both.
   */
  const cycle = Math.floor(index / letters.length) + 1;
  return `${letters[index % letters.length]}${cycle}`;
}

export function rowLabel(
  index: number,
  scheme: RowScheme,
  custom?: string[],
): string {
  switch (scheme) {
    case "numeric":
      return String(index + 1);
    case "persian-alpha":
      return persianRowLabel(index);
    case "custom":
      return custom?.[index] ?? latinRowLabel(index);
    case "latin":
    default:
      return latinRowLabel(index);
  }
}

/**
 * The seat numbers for one row, in **positional order** — element 0 is the
 * seat at the row's `seatOrigin` end.
 *
 * `odd-even` is the European centre-aisle convention: odd numbers climb away
 * from the centre on one side, even on the other, so seat 1 and seat 2 are
 * neighbours at the middle rather than at opposite walls.
 */
export function seatNumbers(spec: NumberingSpec, count: number): number[] {
  const skip = new Set(spec.skip ?? []);

  if (spec.seatScheme === "odd-even") {
    const half = Math.ceil(count / 2);
    const odds: number[] = [];
    const evens: number[] = [];
    let n = spec.seatStart;
    while (odds.length < half) {
      if (!skip.has(n)) odds.push(n);
      n += 2;
    }
    let m = spec.seatStart + 1;
    while (evens.length < count - half) {
      if (!skip.has(m)) evens.push(m);
      m += 2;
    }
    // Odds descend toward the centre, then evens ascend away from it.
    return [...odds.slice().reverse(), ...evens];
  }

  // "sequential" and "block" share the run; "block" restarts per aisle, which
  // the caller expresses by generating one section per block.
  const out: number[] = [];
  let n = spec.seatStart;
  while (out.length < count) {
    if (!skip.has(n)) out.push(n);
    n += 1;
  }
  return out;
}

/**
 * Positional seat labels for a row, ordered left-to-right in layout space.
 *
 * `seatNumbers` yields origin-first order; when the origin is the right-hand
 * end, the array is reversed so index 0 is always the leftmost seat and callers
 * can zip it against x-coordinates without thinking about direction.
 */
export function seatLabelsForRow(
  spec: NumberingSpec,
  count: number,
): string[] {
  const numbers = seatNumbers(spec, count).map(String);
  return spec.seatOrigin === "right" ? numbers.reverse() : numbers;
}

/** Row ordinals in layout order, honouring `rowDirection`. */
export function rowLabelsForSection(
  spec: NumberingSpec,
  count: number,
): string[] {
  const labels = Array.from({ length: count }, (_, i) =>
    rowLabel(i, spec.rowScheme, spec.rowLabels),
  );
  return spec.rowDirection === "back-to-front" ? labels.reverse() : labels;
}
