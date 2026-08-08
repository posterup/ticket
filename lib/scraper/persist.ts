/**
 * Persistence: canonical events → the real Event/EventSession/Venue tables,
 * with provenance in EventSource. Everything here is idempotent — the DB's
 * `UNIQUE(source, sourceEventId)` is the anchor, upserts do the rest — and a
 * dry run computes every decision without a single write.
 *
 * Imported events are owned by one auto-created workspace per source. They
 * carry no TicketTypes: PosterUp displays them, the source sells them.
 *
 * One deliberate mapping: `EventSession.endAt` is a required column, but a
 * source that states no end must not have one invented. Following Davvvat's
 * own convention, endAt === startAt is the "no stated end" sentinel; the true
 * value (null) is recoverable from EventSource.rawData.
 */

import * as P from "@/generated/enums";
import { db } from "@/lib/server/db";

import { contentHash, matchConfidence, MERGE_CONFIDENCE, REVIEW_CONFIDENCE } from "./dedupe";
import { tehranDayString } from "./dates";
import { envNum, slog } from "./http";
import { eventLifecycle, isCurrentlyRelevant } from "./lifecycle";
import type { CanonicalEvent, Lifecycle, SourceId, VerificationResult } from "./types";

export const SOURCE_TO_DB: Record<SourceId, P.ScrapeSource> = {
  "davvvat": P.ScrapeSource.DAVVVAT,
  "fidibo-art": P.ScrapeSource.FIDIBO_ART,
};

const WORKSPACES: Record<SourceId, { slug: string; name: string; bio: string }> = {
  "davvvat": {
    slug: "davvvat",
    name: "دعوت",
    bio: "رویدادهای دعوت (davvvat.ir) — با اجازه رسمی بازنشر می‌شود.",
  },
  "fidibo-art": {
    slug: "fidibo-art",
    name: "فیدیبو آرت",
    bio: "نمایش‌ها و رویدادهای فیدیبو آرت (art.fidibo.com) — با اجازه رسمی بازنشر می‌شود.",
  },
};

/** Fields diffed into EventSourceChange when the content hash moves. */
const TRACKED_FIELDS = [
  "title",
  "startAt",
  "venueName",
  "city",
  "priceText",
  "sourceStatus",
  "externalTicketUrl",
  "posterUrl",
] as const;

function trackedSnapshot(e: CanonicalEvent): Record<string, string | null> {
  return {
    title: e.title,
    startAt: e.sessions[0]?.startAt.toISOString() ?? null,
    venueName: e.venueName,
    city: e.city,
    priceText: e.price.text,
    sourceStatus: e.sourceStatus,
    externalTicketUrl: e.externalTicketUrl,
    posterUrl: e.posterUrl,
  };
}

export type PersistAction =
  | "inserted"
  | "updated"
  | "unchanged"
  | "merged-cross-source"
  | "skipped-finished"
  | "skipped-cancelled"
  | "rejected"
  | "conflict"
  | "review";

export interface PersistOutcome {
  action: PersistAction;
  lifecycle: Lifecycle;
  eventId?: string;
  note?: string;
}

export interface PersistOptions {
  dryRun: boolean;
  now: Date;
}

export async function ensureSourceWorkspace(source: SourceId): Promise<string> {
  const spec = WORKSPACES[source];
  const ws = await db.workspace.upsert({
    where: { slug: spec.slug },
    update: {},
    create: { slug: spec.slug, name: spec.name, bio: spec.bio },
  });
  return ws.id;
}

async function findOrCreateVenue(e: CanonicalEvent): Promise<string> {
  const name = e.venueName ?? e.address ?? e.city ?? "نامشخص";
  const city = e.city ?? "نامشخص";
  const existing = await db.venue.findFirst({ where: { name, city } });
  if (existing) return existing.id;
  const venue = await db.venue.create({
    data: {
      name,
      city,
      address: e.address ?? name,
      // Unknown capacity. Imported events never sell seats here, so this is
      // display-only and 0 reads as "not stated".
      capacity: 0,
      lat: e.latitude,
      lng: e.longitude,
    },
  });
  return venue.id;
}

function eventStatusFor(
  lifecycle: Lifecycle,
  verification: VerificationResult,
): P.EventStatus {
  if (lifecycle === "cancelled") return P.EventStatus.CANCELLED;
  if (lifecycle === "finished") return P.EventStatus.COMPLETED;
  return verification.status === "verified"
    ? P.EventStatus.PUBLISHED
    : P.EventStatus.DRAFT;
}

function slugFor(e: CanonicalEvent): string {
  return e.source === "davvvat"
    ? `dv-${e.sourceEventId}`
    : `fb-${e.sourceEventId}`;
}

/**
 * Cross-source duplicate scan: existing imported events from the *other*
 * source sharing a Tehran calendar day. High confidence attaches this source
 * to the existing event; the uncertain band goes to review and imports
 * separately (never auto-merged).
 */
async function crossSourceMatch(
  e: CanonicalEvent,
): Promise<{ eventId: string; confidence: number } | null> {
  const days = e.sessions.map((s) => s.startAt);
  const from = new Date(Math.min(...days.map((d) => d.getTime())) - 86_400_000);
  const to = new Date(Math.max(...days.map((d) => d.getTime())) + 86_400_000);
  const candidates = await db.event.findMany({
    where: {
      importSources: { some: { source: { not: SOURCE_TO_DB[e.source] } } },
      sessions: { some: { startAt: { gte: from, lte: to } } },
    },
    include: { venue: true, sessions: true },
    take: 50,
  });
  let best: { eventId: string; confidence: number } | null = null;
  for (const c of candidates) {
    const confidence = matchConfidence(e, {
      title: c.title,
      venueName: c.venue.name,
      city: c.venue.city,
      days: c.sessions.map((s) => tehranDayString(s.startAt)),
    });
    if (!best || confidence > best.confidence) {
      best = { eventId: c.id, confidence };
    }
  }
  return best && best.confidence >= REVIEW_CONFIDENCE ? best : null;
}

async function addReview(kind: string, payload: unknown, dryRun: boolean) {
  if (dryRun) return;
  await db.reviewItem.create({ data: { kind, payload: payload as object } });
}

/** Upsert the event + venue + sessions + provenance, all-or-nothing. */
export async function persistEvent(
  e: CanonicalEvent,
  verification: VerificationResult,
  { dryRun, now }: PersistOptions,
): Promise<PersistOutcome> {
  const lifecycle = eventLifecycle(e, now);
  const source = SOURCE_TO_DB[e.source];
  const existing = await db.eventSource.findUnique({
    where: { source_sourceEventId: { source, sourceEventId: e.sourceEventId } },
    include: { event: true },
  });

  // ── Freshness gate: finished/cancelled events are never *imported*. ──
  if (!existing && !isCurrentlyRelevant(lifecycle)) {
    return {
      action: lifecycle === "cancelled" ? "skipped-cancelled" : "skipped-finished",
      lifecycle,
    };
  }

  // ── Quality gate. ──
  if (verification.status === "rejected") {
    if (existing && !dryRun) {
      await db.$transaction(async (tx) => {
        await tx.eventSource.update({
          where: { id: existing.id },
          data: {
            verificationStatus: P.SourceVerification.REJECTED,
            verificationErrors: verification.errors,
            verificationScore: verification.score,
            lastSeenAt: now,
            consecutiveMissingRuns: 0,
          },
        });
        await tx.event.update({
          where: { id: existing.eventId },
          data: { status: P.EventStatus.DRAFT },
        });
      });
    }
    return { action: "rejected", lifecycle, note: verification.errors.join("; ") };
  }

  if (verification.status === "conflict") {
    // Never silently choose a side. Existing data stays as last verified.
    await addReview(
      "conflict",
      {
        source: e.source,
        sourceEventId: e.sourceEventId,
        url: e.sourceUrl,
        errors: verification.errors,
      },
      dryRun,
    );
    if (existing && !dryRun) {
      await db.eventSource.update({
        where: { id: existing.id },
        data: {
          verificationStatus: P.SourceVerification.CONFLICT,
          verificationErrors: verification.errors,
          verificationScore: verification.score,
          lastSeenAt: now,
          consecutiveMissingRuns: 0,
        },
      });
    }
    return { action: "conflict", lifecycle, note: verification.errors.join("; ") };
  }

  const hash = contentHash(e);

  // ── Existing row: unchanged → touch; changed → update + history. ──
  if (existing) {
    if (existing.contentHash === hash && isCurrentlyRelevant(lifecycle)) {
      if (!dryRun) {
        await db.eventSource.update({
          where: { id: existing.id },
          data: { lastSeenAt: now, consecutiveMissingRuns: 0 },
        });
      }
      return { action: "unchanged", lifecycle, eventId: existing.eventId };
    }

    if (!dryRun) {
      const before = (existing.rawData ?? {}) as Record<string, unknown>;
      await db.$transaction(async (tx) => {
        // Change history against the previous snapshot.
        const prev = (before.__tracked ?? {}) as Record<string, string | null>;
        const nextSnapshot = trackedSnapshot(e);
        for (const field of TRACKED_FIELDS) {
          if (prev[field] !== undefined && prev[field] !== nextSnapshot[field]) {
            await tx.eventSourceChange.create({
              data: {
                eventSourceId: existing.id,
                field,
                oldValue: prev[field],
                newValue: nextSnapshot[field],
              },
            });
          }
        }

        const venueId = existing.event.venueId;
        await tx.event.update({
          where: { id: existing.eventId },
          data: {
            title: e.title,
            description: e.description,
            status: eventStatusFor(lifecycle, verification),
            poster: e.posterUrl,
            categories: e.categories,
            tags: e.sourceCategories,
          },
        });

        // Sessions reconcile on @@unique([eventId, startAt]); rows the source
        // no longer lists are cancelled, not deleted.
        const startTimes = e.sessions.map((s) => s.startAt);
        for (const s of e.sessions) {
          await tx.eventSession.upsert({
            where: {
              eventId_startAt: { eventId: existing.eventId, startAt: s.startAt },
            },
            update: {
              endAt: s.endAt ?? s.startAt,
              cancelled: s.cancelled,
              availability: s.soldOut
                ? P.SessionAvailability.FULL
                : P.SessionAvailability.AVAILABLE,
            },
            create: {
              eventId: existing.eventId,
              startAt: s.startAt,
              endAt: s.endAt ?? s.startAt,
              venueId,
              cancelled: s.cancelled,
              availability: s.soldOut
                ? P.SessionAvailability.FULL
                : P.SessionAvailability.AVAILABLE,
            },
          });
        }
        await tx.eventSession.updateMany({
          where: {
            eventId: existing.eventId,
            startAt: { notIn: startTimes },
            cancelled: false,
          },
          data: { cancelled: true },
        });

        await tx.eventSource.update({
          where: { id: existing.id },
          data: {
            rawData: { payload: e.raw, __tracked: nextSnapshot } as object,
            contentHash: hash,
            sourceStatus: sourceStatusFor(lifecycle),
            verificationStatus: P.SourceVerification.VERIFIED,
            verificationScore: verification.score,
            verificationErrors: verification.errors,
            verifiedAt: now,
            priceMin: e.price.min,
            priceMax: e.price.max,
            priceCurrency: e.price.currency,
            isFree: e.price.isFree,
            priceText: e.price.text,
            externalTicketUrl: e.externalTicketUrl,
            lastSeenAt: now,
            consecutiveMissingRuns: 0,
          },
        });
      });
    }
    return { action: "updated", lifecycle, eventId: existing.eventId };
  }

  // ── New event: cross-source duplicate scan, then create. ──
  const match = await crossSourceMatch(e);
  if (match && match.confidence < MERGE_CONFIDENCE) {
    await addReview(
      "possible-duplicate",
      {
        source: e.source,
        sourceEventId: e.sourceEventId,
        url: e.sourceUrl,
        title: e.title,
        matchedEventId: match.eventId,
        confidence: Number(match.confidence.toFixed(3)),
      },
      dryRun,
    );
  }
  const mergeInto = match && match.confidence >= MERGE_CONFIDENCE ? match.eventId : null;

  if (dryRun) {
    return {
      action: mergeInto ? "merged-cross-source" : "inserted",
      lifecycle,
      note: mergeInto ? `merge into ${mergeInto}` : undefined,
    };
  }

  // Find-or-create outside the transaction: both are idempotent, and an
  // orphan venue from a failed event insert is harmless and reused next run.
  const workspaceId = mergeInto ? null : await ensureSourceWorkspace(e.source);
  const venueId = mergeInto ? null : await findOrCreateVenue(e);

  try {
    const eventId = await db.$transaction(async (tx) => {
      let targetEventId = mergeInto;
      if (!targetEventId) {
        const created = await tx.event.create({
          data: {
            workspaceId: workspaceId!,
            title: e.title,
            description: e.description,
            status: eventStatusFor(lifecycle, verification),
            mode: e.sessions.length > 1 ? P.EventMode.MULTI_SESSION : P.EventMode.ONE_TIME,
            venueId: venueId!,
            categories: e.categories,
            tags: e.sourceCategories,
            poster: e.posterUrl,
            slug: slugFor(e),
            sessions: {
              create: e.sessions.map((s) => ({
                startAt: s.startAt,
                endAt: s.endAt ?? s.startAt,
                venueId: venueId!,
                cancelled: s.cancelled,
                availability: s.soldOut
                  ? P.SessionAvailability.FULL
                  : P.SessionAvailability.AVAILABLE,
              })),
            },
          },
        });
        targetEventId = created.id;
      }

      await tx.eventSource.create({
        data: {
          eventId: targetEventId,
          source,
          sourceEventId: e.sourceEventId,
          sourceUrl: e.sourceUrl,
          rawData: { payload: e.raw, __tracked: trackedSnapshot(e) } as object,
          contentHash: hash,
          sourceStatus: sourceStatusFor(lifecycle),
          verificationStatus: P.SourceVerification.VERIFIED,
          verificationScore: verification.score,
          verificationErrors: verification.errors,
          verifiedAt: now,
          priceMin: e.price.min,
          priceMax: e.price.max,
          priceCurrency: e.price.currency,
          isFree: e.price.isFree,
          priceText: e.price.text,
          externalTicketUrl: e.externalTicketUrl,
          firstSeenAt: now,
          lastSeenAt: now,
        },
      });
      return targetEventId;
    });
    return {
      action: mergeInto ? "merged-cross-source" : "inserted",
      lifecycle,
      eventId,
    };
  } catch (error) {
    // A concurrent sync inserted the same (source, sourceEventId) first — the
    // DB constraint is the arbiter; this run just yields.
    if (isUniqueViolation(error)) {
      return { action: "unchanged", lifecycle, note: "lost concurrent insert race" };
    }
    throw error;
  }
}

function sourceStatusFor(lifecycle: Lifecycle): P.SourceStatus {
  if (lifecycle === "cancelled") return P.SourceStatus.CANCELLED;
  if (lifecycle === "finished") return P.SourceStatus.FINISHED;
  return P.SourceStatus.ACTIVE;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/**
 * Reconcile source rows that this run did not discover. Only counts against a
 * *healthy* run — a broken crawl must not unpublish the catalog. Events that
 * are already past stay finished regardless.
 */
export async function reconcileMissing(
  sourceId: SourceId,
  seenSourceEventIds: Set<string>,
  { dryRun, healthy }: { dryRun: boolean; healthy: boolean },
): Promise<{ missing: number; unpublished: number }> {
  if (!healthy) return { missing: 0, unpublished: 0 };
  const threshold = envNum("MISSING_RUNS_BEFORE_UNPUBLISH", 3);
  const source = SOURCE_TO_DB[sourceId];
  const active = await db.eventSource.findMany({
    where: { source, sourceStatus: P.SourceStatus.ACTIVE },
  });
  let missing = 0;
  let unpublished = 0;
  for (const row of active) {
    if (seenSourceEventIds.has(row.sourceEventId)) continue;
    missing += 1;
    const runs = row.consecutiveMissingRuns + 1;
    const past = runs >= threshold;
    if (!dryRun) {
      await db.$transaction(async (tx) => {
        await tx.eventSource.update({
          where: { id: row.id },
          data: {
            consecutiveMissingRuns: runs,
            ...(past ? { sourceStatus: P.SourceStatus.MISSING } : {}),
          },
        });
        if (past) {
          await tx.event.update({
            where: { id: row.eventId },
            data: { status: P.EventStatus.DRAFT },
          });
        }
      });
    }
    if (past) {
      unpublished += 1;
      slog({
        stage: "missing",
        source: sourceId,
        event_id: row.sourceEventId,
        runs,
        status: "unpublished",
      });
    }
  }
  return { missing, unpublished };
}

/**
 * Lifecycle sweep, independent of any crawl: imported events still PUBLISHED
 * whose every session is over (or cancelled) get COMPLETED/CANCELLED. This is
 * what keeps the catalog honest even when the scraper is down.
 */
export async function unpublishFinished(
  { dryRun, now }: PersistOptions,
): Promise<{ unpublished: number }> {
  const cutoff = new Date(now.getTime() - 86_400_000); // grace: full Tehran day
  const candidates = await db.event.findMany({
    where: {
      importSources: { some: {} },
      status: P.EventStatus.PUBLISHED,
    },
    include: { sessions: true },
  });
  let unpublished = 0;
  for (const event of candidates) {
    const live = event.sessions.filter((s) => !s.cancelled);
    const allOver =
      live.length === 0 ||
      live.every((s) => {
        const end = s.endAt.getTime() > s.startAt.getTime() ? s.endAt : s.startAt;
        return end < cutoff;
      });
    if (!allOver) continue;
    unpublished += 1;
    if (!dryRun) {
      await db.event.update({
        where: { id: event.id },
        data: {
          status:
            live.length === 0 ? P.EventStatus.CANCELLED : P.EventStatus.COMPLETED,
        },
      });
      await db.eventSource.updateMany({
        where: { eventId: event.id },
        data: {
          sourceStatus:
            live.length === 0 ? P.SourceStatus.CANCELLED : P.SourceStatus.FINISHED,
        },
      });
    }
  }
  return { unpublished };
}
