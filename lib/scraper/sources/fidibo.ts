/**
 * Fidibo Art adapter — sitemap discovery + the event JSON embedded in the
 * page's RSC flight payload (`self.__next_f.push`). No public API; no JSON-LD.
 *
 * The payload's `eventInfo` object (verified live 2026-08-08) carries title,
 * slug, category, covers, location_info, display_info (summary + duration
 * tags), status, and a sessions[] array whose dates are **year-less Jalali
 * parts** (`day`, `month` name, `week_day`, `time`) — the year is inferred
 * from each session's own `sales_started_at`/`visible_from` and the stated
 * weekday is cross-checked against the inferred date.
 */

import { fetchText, slog } from "../http";
import { canonicalUrl, cleanText, digitsToAscii } from "../normalize";
import { inferJalaliDate } from "../dates";
import type {
  CanonicalCategory,
  CanonicalEvent,
  CanonicalSession,
  DiscoveredRef,
  VerificationResult,
} from "../types";
import { scoreVerification } from "./davvvat";

const BASE = "https://art.fidibo.com";

const CATEGORY_MAP: Record<string, CanonicalCategory> = {
  theater: "theater",
  concert: "concert",
  academy: "workshop",
  fidibo_events: "other",
  cinema: "cinema",
  standup: "standup",
};

// ───────────────────────────── discovery ─────────────────────────────

/**
 * Detail URLs from the sitemap: `/{category}/{slug}-{numericId}`. The numeric
 * suffix is the stable source id; the slug part may be edited by Fidibo.
 */
export function parseSitemap(xml: string): DiscoveredRef[] {
  const refs: DiscoveredRef[] = [];
  for (const m of xml.matchAll(
    /<url>\s*<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]+)<\/lastmod>)?/g,
  )) {
    const loc = decodeURIComponent(m[1].trim());
    let path: string;
    try {
      path = new URL(loc).pathname;
    } catch {
      continue;
    }
    const seg = path.split("/").filter(Boolean);
    if (seg.length !== 2 || !(seg[0] in CATEGORY_MAP)) continue;
    const idMatch = /-(\d+)$/.exec(seg[1]);
    if (!idMatch) continue;
    refs.push({
      sourceEventId: idMatch[1],
      url: canonicalUrl(loc),
      listing: { lastmod: m[2]?.trim() },
    });
  }
  return refs;
}

export async function discoverFidibo(limit?: number): Promise<DiscoveredRef[]> {
  const xml = await fetchText(`${BASE}/sitemap.xml`);
  const refs = parseSitemap(xml);
  slog({ stage: "discover", source: "fidibo-art", discovered: refs.length });
  return limit ? refs.slice(0, limit) : refs;
}

// ─────────────────────── RSC payload extraction ───────────────────────

/** Reassemble the RSC flight stream from the page's inline script chunks. */
export function extractFlight(html: string): string {
  const parts: string[] = [];
  for (const m of html.matchAll(
    /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/gs,
  )) {
    try {
      parts.push(JSON.parse(`"${m[1]}"`) as string);
    } catch {
      // Skip undecodable chunks — the event object lives in one chunk.
    }
  }
  return parts.join("");
}

/** Balanced-brace scan, string-aware. Returns the {...} slice or null. */
function scanObject(s: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

export interface FidiboSession {
  id: number;
  event_title?: string | null;
  is_sold_out?: boolean;
  day: number;
  week_day?: string | null;
  month: string;
  time?: string | null;
  status?: string | null;
  visible_from?: string | null;
  sales_started_at?: string | null;
}

export interface FidiboEventInfo {
  uuid?: string;
  title?: string | null;
  subtitle?: string | null;
  slug?: string | null;
  cover_path?: string | null;
  category?: { name?: string; en_name?: string } | null;
  banners?: { platform?: string; path?: string }[] | null;
  type?: string | null;
  location_info?: {
    address?: string | null;
    venue_name?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  display_info?: {
    summary?: string | null;
    tags?: {
      name?: string;
      type?: { en_name?: string };
    }[];
  } | null;
  status?: string | null;
}

/** The component props object: `{eventId, type, eventInfo, sessions, …}`. */
export interface FidiboPageProps {
  eventId?: string;
  eventInfo?: FidiboEventInfo;
  sessions?: FidiboSession[];
}

/**
 * `eventInfo` and `sessions` are sibling props of one component in the flight
 * stream, so the parent object is what gets extracted: walk back from the
 * `"eventInfo":` key to candidate opening braces until one parses and carries
 * the key.
 */
export function extractPageProps(html: string): FidiboPageProps | null {
  const flight = extractFlight(html);
  const anchor = flight.indexOf('"eventInfo":');
  if (anchor < 0) return null;
  let from = anchor;
  for (let tries = 0; tries < 10; tries++) {
    const braceAt = flight.lastIndexOf("{", from);
    if (braceAt < 0) return null;
    const slice = scanObject(flight, braceAt);
    if (slice) {
      try {
        const props = JSON.parse(slice) as FidiboPageProps;
        if (props.eventInfo) return props;
      } catch {
        // Not a standalone JSON object from here — walk further back.
      }
    }
    from = braceAt - 1;
  }
  return null;
}

export function extractOgTitle(html: string): string | null {
  const m = /<meta property="og:title" content="([^"]*)"/.exec(html);
  return m ? cleanText(m[1]) : null;
}

// ───────────────────────────── parsing ─────────────────────────────

function durationMinutes(info: FidiboEventInfo): number | null {
  for (const tag of info.display_info?.tags ?? []) {
    if (tag.type?.en_name !== "duration") continue;
    const m = /(\d+)\s*(دقیقه|ساعت)/.exec(digitsToAscii(tag.name ?? ""));
    if (m) return Number(m[1]) * (m[2] === "ساعت" ? 60 : 1);
  }
  return null;
}

export interface FidiboParseResult {
  event: CanonicalEvent | null;
  skip?: string;
  /** Sessions whose stated weekday contradicted the inferred date. */
  weekdayMismatches: number;
}

export function parseFidibo(
  ref: DiscoveredRef,
  html: string,
): FidiboParseResult {
  const props = extractPageProps(html);
  const info = props?.eventInfo;
  if (!props || !info)
    return { event: null, skip: "no-payload", weekdayMismatches: 0 };

  const title =
    cleanText(info.title) ||
    extractOgTitle(html) ||
    cleanText(props.sessions?.[0]?.event_title);
  if (!title) return { event: null, skip: "no-title", weekdayMismatches: 0 };

  const status =
    info.status === "published" ? "published"
    : info.status === "cancelled" ? "cancelled"
    : info.status === "draft" ? "draft"
    : "unknown";
  if (status === "draft") return { event: null, skip: "draft", weekdayMismatches: 0 };

  const duration = durationMinutes(info);
  const sessions: CanonicalSession[] = [];
  let weekdayMismatches = 0;
  for (const s of props.sessions ?? []) {
    const hintIso = s.sales_started_at ?? s.visible_from;
    if (!hintIso || !s.day || !s.month) continue;
    const inferred = inferJalaliDate({
      day: s.day,
      monthName: s.month,
      time: s.time ?? null,
      weekDay: s.week_day ?? null,
      hint: new Date(hintIso),
    });
    if (!inferred) continue;
    if (inferred.weekdayMismatch) {
      // The source contradicts itself — surface for review, do not guess.
      weekdayMismatches += 1;
      continue;
    }
    sessions.push({
      startAt: inferred.startAt,
      // A source-stated running time is not an invented end.
      endAt:
        duration && !inferred.dateOnly
          ? new Date(inferred.startAt.getTime() + duration * 60_000)
          : null,
      dateOnly: inferred.dateOnly,
      cancelled: false,
      soldOut: s.is_sold_out === true,
      sourceStatus: s.status ?? null,
    });
  }
  if (sessions.length === 0) {
    return {
      event: null,
      skip: weekdayMismatches > 0 ? "ambiguous-dates" : "no-sessions",
      weekdayMismatches,
    };
  }

  const category =
    CATEGORY_MAP[info.category?.en_name ?? ""] ??
    CATEGORY_MAP[new URL(ref.url).pathname.split("/")[1]] ??
    "other";

  const poster =
    info.cover_path ??
    info.banners?.find((b) => b.platform === "desktop")?.path ??
    info.banners?.[0]?.path ??
    null;

  const event: CanonicalEvent = {
    source: "fidibo-art",
    sourceEventId: ref.sourceEventId,
    sourceUrl: ref.url,
    title,
    description: cleanText(info.display_info?.summary),
    categories: [category],
    sourceCategories: [info.category?.en_name ?? "", info.category?.name ?? ""]
      .filter(Boolean),
    // location_info has no city field; never inferred from the address.
    city: null,
    venueName: cleanText(info.location_info?.venue_name) || null,
    address: cleanText(info.location_info?.address) || null,
    latitude: info.location_info?.latitude ?? null,
    longitude: info.location_info?.longitude ?? null,
    organizerName: null,
    sessions,
    sourceStatus: status,
    soldOut: sessions.every((s) => s.soldOut),
    posterUrl: poster ? canonicalUrl(poster) : null,
    // Prices load per-session client-side and are not in this payload; the
    // event page itself is where tickets are sold.
    price: { min: null, max: null, currency: null, isFree: null, text: null },
    externalTicketUrl: ref.url,
    raw: props,
  };
  return { event, weekdayMismatches };
}

// ─────────────────────────── verification ───────────────────────────

/**
 * Fidibo has no second structured surface (no JSON-LD, no API), so the
 * cross-check compares independent representations of the same page: the
 * server-rendered OG meta vs the embedded data payload, plus the per-session
 * weekday consistency already enforced in parsing.
 */
export async function verifyFidibo(
  event: CanonicalEvent,
  html: string,
  weekdayMismatches: number,
): Promise<VerificationResult> {
  const checks: Record<string, boolean> = {};
  const errors: string[] = [];

  const og = extractOgTitle(html);
  checks.source = og !== null;
  if (og) {
    checks.title = og === event.title || og.includes(event.title) || event.title.includes(og);
    if (!checks.title) {
      errors.push(`title differs: og=«${og}» payload=«${event.title}»`);
    }
  }
  checks.date = weekdayMismatches === 0;
  if (weekdayMismatches > 0) {
    errors.push(`${weekdayMismatches} session(s) with weekday/date contradiction`);
  }
  return scoreVerification(event, checks, errors);
}
