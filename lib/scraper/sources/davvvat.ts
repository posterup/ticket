/**
 * Davvvat adapter — authorized API first, public page JSON-LD for verification.
 *
 * Primary source: `GET /cms-api/events` (Payload-CMS-style REST; paginated,
 * fetch-by-id). Verified live 2026-08-08: 564 docs, anonymous reads allowed,
 * cookies (`davvvat_token`, `davvvat_session`) sent when configured.
 *
 * Date semantics (verified against rendered pages, do not "fix"):
 *  - API `startDate`/`endDate` are Tehran wall time with a fake `Z` suffix.
 *  - Page JSON-LD start/end are date-only, encoded as Tehran-midnight-in-UTC.
 *  - `startDate === endDate` means the source gave no real end.
 */

import { fetchJson, fetchText, slog } from "../http";
import { canonicalUrl, cleanText, parsePrice } from "../normalize";
import { fakeZTehranToUtc, tehranDayString } from "../dates";
import type {
  CanonicalCategory,
  CanonicalEvent,
  CanonicalSession,
  DiscoveredRef,
  VerificationResult,
} from "../types";

const BASE = "https://davvvat.ir";

/** Raw API doc — only the fields the adapter reads. */
export interface DavvvatDoc {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  status?: string | null;
  mode?: string | null;
  isPrivate?: boolean;
  isExpired?: boolean;
  isSoldOut?: boolean;
  isWeekly?: boolean;
  city?: string | null;
  area?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  startDate?: string | null;
  startTime?: string | null;
  endDate?: string | null;
  endTime?: string | null;
  cover?: string | null;
  eventCategories?: string[] | null;
  types?: string[] | null;
  ticketPrice?: { isFree?: string | null; priceText?: string | null } | null;
  ticketLink?: string | null;
  onlineLink?: string | null;
  updatedAt?: string | null;
}

interface DavvvatPage {
  docs: DavvvatDoc[];
  hasNextPage: boolean;
  page: number;
  totalDocs: number;
}

function authHeaders(): Record<string, string> {
  const token = process.env.DAVVVAT_TOKEN;
  const session = process.env.DAVVVAT_SESSION;
  if (!token) return {};
  const cookie = [`davvvat_token=${token}`, session && `davvvat_session=${session}`]
    .filter(Boolean)
    .join("; ");
  return { cookie };
}

export function eventUrl(slug: string): string {
  return `${BASE}/event/${slug}`;
}

const DATE_PART = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

function sameDatePart(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

/**
 * Combine a fake-Z date stamp with an optional explicit "HH:mm" field into a
 * UTC instant. The explicit field always wins over the stamp's own clock;
 * `dateOnly` marks a midnight stamp with no field.
 */
function combineWall(
  dateIso: string,
  time: string | null | undefined,
): { at: Date; dateOnly: boolean } | null {
  const d = DATE_PART.exec(dateIso);
  if (!d) return null;
  const clock = /^(\d{1,2}):(\d{2})/.exec(time?.trim() ?? "");
  const hour = clock ? Number(clock[1]) : Number(d[4]);
  const minute = clock ? Number(clock[2]) : Number(d[5]);
  const base = fakeZTehranToUtc(`${d[1]}-${d[2]}-${d[3]}T00:00:00.000Z`);
  return {
    at: new Date(base.getTime() + hour * 3_600_000 + minute * 60_000),
    dateOnly: !clock && hour === 0 && minute === 0,
  };
}

/** Enumerate every event doc via the API. Returns raw docs keyed for reuse. */
export async function discoverDavvvat(limit?: number): Promise<DavvvatDoc[]> {
  const docs: DavvvatDoc[] = [];
  let page = 1;
  for (;;) {
    const data = await fetchJson<DavvvatPage>(
      `${BASE}/cms-api/events?limit=100&page=${page}`,
      { headers: authHeaders() },
    );
    docs.push(...data.docs);
    if (limit && docs.length >= limit) return docs.slice(0, limit);
    if (!data.hasNextPage) break;
    page += 1;
  }
  slog({ stage: "discover", source: "davvvat", discovered: docs.length });
  return docs;
}

export function davvvatRefs(docs: DavvvatDoc[]): DiscoveredRef[] {
  return docs.map((d) => ({
    sourceEventId: d.slug,
    url: eventUrl(d.slug),
    listing: { title: d.name, lastmod: d.updatedAt ?? undefined },
  }));
}

const CATEGORY_MAP: Record<string, CanonicalCategory> = {
  "music": "concert",
  "concert": "concert",
  "theater": "theater",
  "culture-art": "performance",
  "learning-skill": "workshop",
  "learn-discover": "workshop",
  "experience-fun": "other",
  "business": "conference",
  "tech": "conference",
  "cinema": "cinema",
  "standup": "standup",
  "exhibition": "exhibition",
  "festival": "festival",
};

function mapCategories(sourceCategories: string[]): CanonicalCategory[] {
  const mapped = new Set<CanonicalCategory>();
  for (const c of sourceCategories) {
    const hit = CATEGORY_MAP[c];
    if (hit) mapped.add(hit);
  }
  // Ambiguous source categories stay unclassified rather than mislabeled.
  if (mapped.size === 0) mapped.add("other");
  return [...mapped];
}

/**
 * Parse an API doc into the canonical shape. Returns null for docs that are
 * not importable at all (private, unpublished, undated) — with the reason.
 */
export function parseDavvvat(
  doc: DavvvatDoc,
): { event: CanonicalEvent | null; skip?: string } {
  if (doc.isPrivate) return { event: null, skip: "private" };
  const status =
    doc.status === "published" ? "published"
    : doc.status === "cancelled" ? "cancelled"
    : doc.status === "draft" ? "draft"
    : "unknown";
  if (status === "draft") return { event: null, skip: "draft" };

  const title = cleanText(doc.name);
  if (!title) return { event: null, skip: "no-title" };
  if (!doc.startDate) return { event: null, skip: "no-date" };

  // Davvvat date shapes, all fake-Z Tehran wall time (verified live):
  //  - time in the date stamp, startTime null   → stamp is the wall time
  //  - midnight stamp + separate "HH:mm" fields → the explicit field wins
  //  - both a non-midnight stamp AND a field    → the explicit field wins
  //  - midnight stamp, no field                 → date-only listing
  const start = combineWall(doc.startDate, doc.startTime);
  if (!start) return { event: null, skip: "bad-date" };
  const startAt = start.at;

  let endAt: Date | null = null;
  if (doc.endDate) {
    const end = combineWall(doc.endDate, doc.endTime);
    if (end) {
      if (end.dateOnly && sameDatePart(doc.startDate, doc.endDate)) {
        // start === end with no end time means "no stated end".
        endAt = null;
      } else if (end.dateOnly) {
        // A date-only range ("runs until the 21st") ends when its last
        // Tehran day does.
        endAt = new Date(end.at.getTime() + 86_400_000);
      } else {
        endAt = end.at;
      }
      if (endAt && endAt.getTime() === startAt.getTime()) endAt = null;
      // An end clock earlier than the start clock on the same day crosses
      // midnight (e.g. 23:00 → 01:00).
      if (
        endAt &&
        endAt.getTime() < startAt.getTime() &&
        sameDatePart(doc.startDate, doc.endDate)
      ) {
        endAt = new Date(endAt.getTime() + 86_400_000);
      }
    }
  }
  if (endAt && endAt.getTime() < startAt.getTime()) {
    return { event: null, skip: "end-before-start" };
  }
  const startIsMidnight = start.dateOnly;

  const session: CanonicalSession = {
    startAt,
    endAt,
    dateOnly: startIsMidnight,
    cancelled: status === "cancelled",
    soldOut: doc.isSoldOut === true,
    sourceStatus: doc.status ?? null,
  };

  const sourceCategories = [
    ...(doc.eventCategories ?? []),
    ...(doc.types ?? []),
  ];

  const price = parsePrice(doc.ticketPrice?.priceText);
  if (doc.ticketPrice?.isFree === "free" && price.isFree === null) {
    price.isFree = true;
    price.min ??= 0;
    price.max ??= 0;
  }

  const online = doc.mode === "online";
  const event: CanonicalEvent = {
    source: "davvvat",
    sourceEventId: doc.slug,
    sourceUrl: eventUrl(doc.slug),
    title,
    description: cleanText(doc.description),
    categories: mapCategories(sourceCategories),
    sourceCategories,
    city: cleanText(doc.city) || (online ? "آنلاین" : null),
    venueName: cleanText(doc.area) || null,
    address: cleanText(doc.address) || null,
    latitude: doc.latitude ?? null,
    longitude: doc.longitude ?? null,
    organizerName: null, // filled from JSON-LD during verification
    sessions: [session],
    sourceStatus: status,
    soldOut: doc.isSoldOut === true,
    posterUrl: doc.cover ? canonicalUrl(doc.cover) : null,
    price,
    externalTicketUrl: doc.ticketLink
      ? canonicalUrl(doc.ticketLink)
      : doc.onlineLink
        ? canonicalUrl(doc.onlineLink)
        : null,
    raw: doc,
  };
  return { event };
}

// ─────────────────────────── verification ───────────────────────────

interface JsonLdEvent {
  "@type"?: string;
  name?: string;
  startDate?: string;
  location?: { name?: string };
  organizer?: { name?: string };
  eventStatus?: string;
}

export function extractJsonLd(html: string): JsonLdEvent | null {
  const m = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[1]) as JsonLdEvent;
    return parsed["@type"] === "Event" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Cross-check the API doc against the public page's JSON-LD. The page's
 * startDate is date-only (Tehran midnight as UTC), so dates are compared as
 * Tehran calendar days, never as instants. Also harvests the organizer name,
 * which the API only exposes as an opaque id.
 */
export async function verifyDavvvat(
  event: CanonicalEvent,
): Promise<VerificationResult> {
  const checks: Record<string, boolean> = {};
  const errors: string[] = [];

  let ld: JsonLdEvent | null = null;
  try {
    ld = extractJsonLd(await fetchText(event.sourceUrl));
  } catch (error) {
    errors.push(
      `detail page unreachable: ${error instanceof Error ? error.message : error}`,
    );
  }
  checks.source = ld !== null;

  if (ld) {
    checks.title = cleanText(ld.name) === event.title;
    if (!checks.title) {
      errors.push(`title differs: page=«${cleanText(ld.name)}» api=«${event.title}»`);
    }

    if (ld.startDate) {
      // JSON-LD midnight-Tehran-as-UTC vs API instant → compare Tehran days.
      const pageDay = tehranDayString(new Date(ld.startDate));
      const apiDay = tehranDayString(event.sessions[0].startAt);
      checks.date = pageDay === apiDay;
      if (!checks.date) {
        errors.push(`date differs: page=${pageDay} api=${apiDay}`);
      }
    } else {
      checks.date = false;
      errors.push("page JSON-LD has no startDate");
    }

    const ldVenue = cleanText(ld.location?.name);
    checks.venue =
      !event.venueName || !ldVenue || ldVenue.includes(event.venueName);
    if (!checks.venue) {
      errors.push(`venue differs: page=«${ldVenue}» api=«${event.venueName}»`);
    }

    const cancelledOnPage = /EventCancelled/.test(ld.eventStatus ?? "");
    checks.status = cancelledOnPage === (event.sourceStatus === "cancelled");
    if (!checks.status) errors.push("cancellation state differs between page and api");

    const organizer = cleanText(ld.organizer?.name);
    if (organizer) event.organizerName = organizer;
  }

  return scoreVerification(event, checks, errors);
}

/** Shared deterministic scoring. Exported for the Fidibo adapter and tests. */
export function scoreVerification(
  event: CanonicalEvent,
  checks: Record<string, boolean>,
  errors: string[],
): VerificationResult {
  checks.titleValid = event.title.length >= 2;
  checks.dateValid = event.sessions.length > 0;
  checks.venueValid = Boolean(event.venueName || event.address);
  checks.cityValid = Boolean(event.city);
  checks.posterValid = Boolean(event.posterUrl?.startsWith("https://"));
  checks.ticketValid = Boolean(event.externalTicketUrl);
  checks.descriptionValid = event.description.length >= 20;

  let score = 0;
  if (checks.titleValid) score += 20;
  if (checks.dateValid) score += 20;
  if (checks.venueValid) score += 15;
  if (checks.cityValid) score += 10;
  if (checks.posterValid) score += 10;
  if (checks.ticketValid) score += 5;
  if (checks.descriptionValid) score += 5;
  // Cross-verification against the second surface.
  if (checks.source) score += 5;
  if (checks.title !== false && checks.date !== false && checks.status !== false)
    score += 10;

  const crossConflict =
    checks.title === false || checks.date === false || checks.status === false;
  const status: VerificationResult["status"] =
    !checks.titleValid || !checks.dateValid || score < 70 ? "rejected"
    : crossConflict ? "conflict"
    : "verified";
  return { status, score, errors, checks };
}
