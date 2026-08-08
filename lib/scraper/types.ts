/**
 * Canonical shapes the source adapters produce and the generic pipeline
 * (normalize → validate → verify → dedupe → lifecycle → persist) consumes.
 * Source-specific knowledge must not leak past this file.
 */

export type SourceId = "davvvat" | "fidibo-art";

/** PosterUp's canonical event categories (Event.categories values). */
export type CanonicalCategory =
  | "theater"
  | "concert"
  | "cinema"
  | "standup"
  | "exhibition"
  | "workshop"
  | "festival"
  | "conference"
  | "talk"
  | "performance"
  | "other";

export interface PriceInfo {
  /** Integer, in the currency the source stated. Null = source did not say. */
  min: number | null;
  max: number | null;
  /** "تومان" | "ریال" — exactly as the source stated; never assumed. */
  currency: string | null;
  isFree: boolean | null;
  /** Original wording, preserved verbatim for display and audit. */
  text: string | null;
}

export interface CanonicalSession {
  /** UTC instant. For date-only sources this is Tehran midnight. */
  startAt: Date;
  /** Null when the source gives no end — never invented. */
  endAt: Date | null;
  /** The source gave a calendar date but no clock time. */
  dateOnly: boolean;
  cancelled: boolean;
  soldOut: boolean;
  /** Per-session status verbatim from the source ("live", "finished", …). */
  sourceStatus: string | null;
}

export interface CanonicalEvent {
  source: SourceId;
  sourceEventId: string;
  sourceUrl: string;

  title: string;
  description: string;
  categories: CanonicalCategory[];
  /** Source's own category labels, kept for audit/debugging. */
  sourceCategories: string[];

  city: string | null;
  venueName: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  organizerName: string | null;

  /** At least one; adapters reject listings they cannot date. */
  sessions: CanonicalSession[];

  /** Event-level status verbatim-ish: published | cancelled | draft | unknown. */
  sourceStatus: "published" | "cancelled" | "draft" | "unknown";
  soldOut: boolean;

  posterUrl: string | null;
  price: PriceInfo;
  externalTicketUrl: string | null;

  /** The structured payload as fetched — persisted to EventSource.rawData. */
  raw: unknown;
}

export type Lifecycle =
  | "upcoming"
  | "ongoing"
  | "finished"
  | "cancelled"
  | "postponed"
  | "sold_out"
  | "unknown";

export interface VerificationResult {
  status: "verified" | "conflict" | "rejected" | "pending";
  score: number;
  errors: string[];
  checks: Record<string, boolean>;
}

export interface StageError {
  source: SourceId;
  sourceEventId: string | null;
  url: string | null;
  stage: string;
  error: string;
  at: string;
}

/** One discovered listing reference, before the detail fetch. */
export interface DiscoveredRef {
  sourceEventId: string;
  url: string;
  /** Listing-side snapshot used for listing↔detail verification. */
  listing: { title?: string; lastmod?: string };
}
