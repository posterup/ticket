/**
 * Persian text, price, and URL normalization.
 *
 * Two tiers, used for different purposes:
 *  - `cleanText`  — what gets stored: Arabic→Persian letter unification,
 *    entity/tag stripping, whitespace hygiene. Preserves ZWNJ and Persian
 *    numerals — those are typography, not noise.
 *  - `foldForMatch` — what gets compared: additionally folds digits to ASCII,
 *    drops ZWNJ and punctuation. Never stored.
 */

import { createHash } from "node:crypto";

import type { PriceInfo } from "./types";

const ARABIC_TO_PERSIAN: Record<string, string> = {
  "ي": "ی", // ي → ی
  "ى": "ی", // ى → ی
  "ك": "ک", // ك → ک
  "ة": "ه", // ة → ه
};

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&zwnj;": "‌",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&[a-z]+;/gi, (m) => HTML_ENTITIES[m.toLowerCase()] ?? m);
}

export function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, " ");
}

/** Persian (۰-۹) and Arabic (٠-٩) digits → ASCII; Persian separators too. */
export function digitsToAscii(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/٬/g, ",") // ٬ thousands
    .replace(/٫/g, "."); // ٫ decimal
}

/** Normalization applied before storage. Keeps ZWNJ and Persian numerals. */
export function cleanText(input: string | null | undefined): string {
  if (!input) return "";
  let s = decodeEntities(stripTags(input)).normalize("NFC");
  s = s.replace(/[يىكة]/g, (c) => ARABIC_TO_PERSIAN[c] ?? c);
  // Zero-width & bidi controls, except ZWNJ (U+200C) which Persian needs.
  s = s.replace(/[​‍‎‏﻿⁠]/g, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** Aggressive fold for fingerprints and fuzzy matching. Never stored. */
export function foldForMatch(input: string | null | undefined): string {
  let s = digitsToAscii(cleanText(input)).toLowerCase();
  s = s.replace(/‌/g, ""); // ZWNJ out entirely for comparison
  s = s.replace(/[^\p{L}\p{N} ]+/gu, " ");
  return s.replace(/\s+/g, " ").trim();
}

export function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** Lowercased host, no hash, no tracking params, no trailing slash. */
export function canonicalUrl(input: string): string {
  try {
    const u = new URL(input);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|ref$|fbclid|gclid)/i.test(key)) u.searchParams.delete(key);
    }
    u.pathname = u.pathname.replace(/\/+$/, "") || "/";
    return u.toString().replace(/\/$/, "");
  } catch {
    return input.trim();
  }
}

// ───────────────────────────── price parsing ─────────────────────────────

const FREE_RE = /رایگان|ورود\s*آزاد/;

/**
 * Parse Persian price text. Currency is stored only when the source names it;
 * digits without تومان/ریال keep currency null. Text without any digits and
 * without «رایگان» yields all-null numbers with the original preserved —
 * e.g. «به دایرکت برگزارکننده مراجعه فرمایید».
 */
export function parsePrice(input: string | null | undefined): PriceInfo {
  const original = input ? cleanText(input) : null;
  const none: PriceInfo = {
    min: null,
    max: null,
    currency: null,
    isFree: null,
    text: original,
  };
  if (!original) return none;

  if (FREE_RE.test(original)) {
    return { min: 0, max: 0, currency: null, isFree: true, text: original };
  }

  const ascii = digitsToAscii(original);
  const currency = /تومان/.test(ascii) ? "تومان" : /ریال/.test(ascii) ? "ریال" : null;

  // Free text is full of numbers that are NOT prices — phone numbers, dates,
  // times, capacities. A number only counts when a multiplier word follows it
  // or a currency word sits within a few characters after it. In a Persian
  // range («۲۰۰ تا ۴۵۰ هزار تومان») the first number elides the unit shared
  // with the second, so an eligible number lends its multiplier to a bare
  // number right before «تا».
  const amounts: number[] = [];
  const numRe =
    /(\d[\d,]*(?:\.\d+)?)\s*(هزار|میلیون|میلیارد)?(\s*(?:تومان|ریال))?/g;
  const MULT: Record<string, number> = {
    "هزار": 1_000,
    "میلیون": 1_000_000,
    "میلیارد": 1_000_000_000,
  };
  for (const m of ascii.matchAll(numRe)) {
    const hasCurrencyNear =
      Boolean(m[3]) ||
      /^\s*(?:تومان|ریال)/.test(ascii.slice(m.index + m[0].length, m.index + m[0].length + 8));
    if (!m[2] && !hasCurrencyNear) continue;
    const base = Number(m[1].replace(/,/g, ""));
    if (!Number.isFinite(base) || base <= 0) continue;
    const mult = m[2] ? MULT[m[2]] : 1;
    amounts.push(Math.round(base * mult));

    // Shared-unit range: «X تا <this match>».
    const before = ascii.slice(Math.max(0, m.index - 24), m.index);
    const range = /(\d[\d,]*)\s*تا\s*$/.exec(before);
    if (range) {
      const first = Number(range[1].replace(/,/g, ""));
      if (Number.isFinite(first) && first > 0) {
        amounts.push(Math.round(first * mult));
      }
    }
  }
  // Anything that cannot be a real Toman/Rial price (or fit an Int column)
  // means the text was not a price statement — keep the words, not numbers.
  const plausible = amounts.filter((a) => a < 2_000_000_000);
  if (plausible.length === 0 || plausible.length !== amounts.length) return none;

  const min = Math.min(...plausible);
  const max = Math.max(...plausible);
  const openEnded = /(^|\s)از\s/.test(ascii) && plausible.length === 1;
  return {
    min,
    max: openEnded ? null : max,
    currency,
    isFree: false,
    text: original,
  };
}
