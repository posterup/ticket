/**
 * Duplicate detection beyond the database's `UNIQUE(source, sourceEventId)`:
 * a stable content fingerprint for exact re-listings, and a scored fuzzy
 * match for the same real-world event appearing on both sources.
 */

import { tehranDayString } from "./dates";
import { foldForMatch, sha256 } from "./normalize";
import type { CanonicalEvent } from "./types";

/** Stable identity fingerprint: title + first day + venue + city. */
export function fingerprint(e: CanonicalEvent): string {
  const day = e.sessions[0] ? tehranDayString(e.sessions[0].startAt) : "";
  return sha256(
    [
      foldForMatch(e.title),
      day,
      foldForMatch(e.venueName ?? e.address ?? ""),
      foldForMatch(e.city ?? ""),
    ].join("|"),
  );
}

/**
 * Hash over every meaningful field — unchanged hash means the source content
 * did not change and no Event write is needed.
 */
export function contentHash(e: CanonicalEvent): string {
  return sha256(
    JSON.stringify({
      title: foldForMatch(e.title),
      description: e.description,
      sessions: e.sessions.map((s) => [
        s.startAt.toISOString(),
        s.endAt?.toISOString() ?? null,
        s.cancelled,
        s.soldOut,
        s.sourceStatus,
      ]),
      venue: e.venueName,
      address: e.address,
      city: e.city,
      status: e.sourceStatus,
      soldOut: e.soldOut,
      poster: e.posterUrl,
      price: [e.price.min, e.price.max, e.price.currency, e.price.isFree, e.price.text],
      ticket: e.externalTicketUrl,
      categories: [...e.categories].sort(),
    }),
  );
}

function tokens(s: string): Set<string> {
  return new Set(foldForMatch(s).split(" ").filter(Boolean));
}

/** Dice coefficient with a containment floor ("شازده کوچولو" ⊂ "نمایش شازده کوچولو"). */
export function titleSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const dice = (2 * inter) / (ta.size + tb.size);
  const containment = inter / Math.min(ta.size, tb.size);
  return Math.max(dice, containment === 1 ? 0.95 : 0);
}

export interface MatchCandidate {
  title: string;
  venueName: string | null;
  city: string | null;
  /** Tehran day strings of its sessions. */
  days: string[];
}

/**
 * Confidence that `e` and `candidate` are the same real-world event.
 * Sharing a calendar day is a hard requirement; title dominates, venue and
 * city corroborate. City unknown on either side is neutral, not a mismatch.
 */
export function matchConfidence(
  e: CanonicalEvent,
  candidate: MatchCandidate,
): number {
  const days = new Set(e.sessions.map((s) => tehranDayString(s.startAt)));
  if (!candidate.days.some((d) => days.has(d))) return 0;

  const title = titleSimilarity(e.title, candidate.title);
  const venue =
    e.venueName && candidate.venueName
      ? titleSimilarity(e.venueName, candidate.venueName)
      : 0.5;
  const city =
    e.city && candidate.city
      ? e.city === candidate.city
        ? 1
        : 0
      : 0.5;
  return 0.55 * title + 0.3 * venue + 0.15 * city;
}

/** Tuned thresholds — see docs/scraper.md before changing. */
export const MERGE_CONFIDENCE = 0.95;
export const REVIEW_CONFIDENCE = 0.8;
