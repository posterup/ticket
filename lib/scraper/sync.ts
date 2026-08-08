/**
 * Sync orchestration: discover → parse → validate → verify → persist →
 * reconcile missing → report, per source, with per-event error isolation and
 * health checks against the previous run's discovery count.
 *
 * Safe to run at any interval; a full run is also safe to repeat immediately
 * (idempotent by construction — see persist.ts).
 */

import * as P from "@/generated/enums";
import { db } from "@/lib/server/db";

import { envNum, mapLimit, slog } from "./http";
import { eventLifecycle, hasPlausibleDates, isCurrentlyRelevant } from "./lifecycle";
import {
  persistEvent,
  reconcileMissing,
  SOURCE_TO_DB,
  unpublishFinished,
} from "./persist";
import {
  davvvatRefs,
  discoverDavvvat,
  parseDavvvat,
  verifyDavvvat,
} from "./sources/davvvat";
import { discoverFidibo, parseFidibo, verifyFidibo } from "./sources/fidibo";
import { fetchText } from "./http";
import type { SourceId, StageError } from "./types";

export interface SourceCounters {
  discovered: number;
  parsed: number;
  new: number;
  updated: number;
  unchanged: number;
  mergedCrossSource: number;
  finishedSkipped: number;
  cancelledSkipped: number;
  rejected: number;
  conflicts: number;
  reviewQueued: number;
  missing: number;
  unpublishedMissing: number;
  skippedOther: number;
  errors: number;
}

export interface SourceReport {
  source: SourceId;
  healthy: boolean;
  healthNote?: string;
  counters: SourceCounters;
  errors: StageError[];
  durationMs: number;
}

export interface SyncReport {
  dryRun: boolean;
  startedAt: string;
  sources: SourceReport[];
  lifecycleUnpublished: number;
  publishedNow: number;
}

export interface SyncOptions {
  sources: SourceId[];
  dryRun: boolean;
  limit?: number;
  now?: Date;
}

function emptyCounters(): SourceCounters {
  return {
    discovered: 0,
    parsed: 0,
    new: 0,
    updated: 0,
    unchanged: 0,
    mergedCrossSource: 0,
    finishedSkipped: 0,
    cancelledSkipped: 0,
    rejected: 0,
    conflicts: 0,
    reviewQueued: 0,
    missing: 0,
    unpublishedMissing: 0,
    skippedOther: 0,
    errors: 0,
  };
}

/**
 * A run is healthy when it discovered at least the configured floor and did
 * not fall off a cliff versus the previous run. Unhealthy runs still import
 * what they found, but never count events as missing.
 */
async function checkHealth(
  source: SourceId,
  discovered: number,
): Promise<{ healthy: boolean; note?: string }> {
  const floors: Record<SourceId, number> = {
    "davvvat": envNum("SCRAPER_MIN_EXPECTED_DAVVVAT", 50),
    "fidibo-art": envNum("SCRAPER_MIN_EXPECTED_FIDIBO", 5),
  };
  if (discovered < floors[source]) {
    return {
      healthy: false,
      note: `discovered ${discovered} < floor ${floors[source]}`,
    };
  }
  const previous = await db.scrapeRun.findFirst({
    where: { source: SOURCE_TO_DB[source], status: "ok", dryRun: false },
    orderBy: { startedAt: "desc" },
  });
  const prevDiscovered = (previous?.counters as SourceCounters | null)?.discovered;
  if (prevDiscovered && discovered < prevDiscovered * 0.5) {
    return {
      healthy: false,
      note: `discovered ${discovered}, previous run ${prevDiscovered} (>50% drop)`,
    };
  }
  return { healthy: true };
}

function stageError(
  source: SourceId,
  sourceEventId: string | null,
  url: string | null,
  stage: string,
  error: unknown,
): StageError {
  return {
    source,
    sourceEventId,
    url,
    stage,
    error: error instanceof Error ? error.message : String(error),
    at: new Date().toISOString(),
  };
}

async function syncDavvvat(
  opts: SyncOptions,
  now: Date,
): Promise<SourceReport> {
  const started = Date.now();
  const counters = emptyCounters();
  const errors: StageError[] = [];
  const seen = new Set<string>();

  let docs;
  try {
    docs = await discoverDavvvat(opts.limit);
  } catch (error) {
    errors.push(stageError("davvvat", null, null, "discover", error));
    return {
      source: "davvvat",
      healthy: false,
      healthNote: "discovery failed",
      counters,
      errors,
      durationMs: Date.now() - started,
    };
  }
  counters.discovered = docs.length;
  const health = await checkHealth("davvvat", docs.length);

  const concurrency = envNum("SCRAPER_CONCURRENCY", 2);
  await mapLimit(davvvatRefs(docs), concurrency, async (ref, i) => {
    const doc = docs[i];
    try {
      const { event, skip } = parseDavvvat(doc);
      seen.add(ref.sourceEventId);
      if (!event) {
        counters.skippedOther += 1;
        if (skip) slog({ stage: "parse", source: "davvvat", event_id: ref.sourceEventId, skip });
        return;
      }
      counters.parsed += 1;
      if (!hasPlausibleDates(event, now)) {
        counters.rejected += 1;
        errors.push(
          stageError("davvvat", ref.sourceEventId, ref.url, "validate", "implausible dates"),
        );
        return;
      }
      // Verification costs a detail-page fetch. An event that is already over
      // will never be published, so it skips the fetch entirely — persist
      // still records its finished/cancelled state.
      const verification = isCurrentlyRelevant(eventLifecycle(event, now))
        ? await verifyDavvvat(event)
        : { status: "pending" as const, score: 0, errors: [], checks: {} };
      tally(counters, (await persistEvent(event, verification, { dryRun: opts.dryRun, now })).action);
      if (verification.status === "conflict") counters.reviewQueued += 1;
    } catch (error) {
      counters.errors += 1;
      errors.push(stageError("davvvat", ref.sourceEventId, ref.url, "pipeline", error));
    }
  });

  const missing = await reconcileMissing("davvvat", seen, {
    dryRun: opts.dryRun,
    // A partial (--limit) crawl must never count absence as missing.
    healthy: health.healthy && !opts.limit,
  });
  counters.missing = missing.missing;
  counters.unpublishedMissing = missing.unpublished;

  return {
    source: "davvvat",
    healthy: health.healthy,
    healthNote: health.note,
    counters,
    errors,
    durationMs: Date.now() - started,
  };
}

async function syncFidibo(opts: SyncOptions, now: Date): Promise<SourceReport> {
  const started = Date.now();
  const counters = emptyCounters();
  const errors: StageError[] = [];
  const seen = new Set<string>();

  let refs;
  try {
    refs = await discoverFidibo(opts.limit);
  } catch (error) {
    errors.push(stageError("fidibo-art", null, null, "discover", error));
    return {
      source: "fidibo-art",
      healthy: false,
      healthNote: "discovery failed",
      counters,
      errors,
      durationMs: Date.now() - started,
    };
  }
  counters.discovered = refs.length;
  const health = await checkHealth("fidibo-art", refs.length);

  const concurrency = envNum("SCRAPER_CONCURRENCY", 2);
  await mapLimit(refs, concurrency, async (ref) => {
    try {
      const html = await fetchText(ref.url);
      seen.add(ref.sourceEventId);
      const { event, skip, weekdayMismatches } = parseFidibo(ref, html);
      if (!event) {
        counters.skippedOther += 1;
        slog({ stage: "parse", source: "fidibo-art", event_id: ref.sourceEventId, skip });
        if (skip === "ambiguous-dates" && !opts.dryRun) {
          await db.reviewItem.create({
            data: {
              kind: "ambiguous-date",
              payload: { source: "fidibo-art", sourceEventId: ref.sourceEventId, url: ref.url },
            },
          });
          counters.reviewQueued += 1;
        }
        return;
      }
      counters.parsed += 1;
      if (!hasPlausibleDates(event, now)) {
        counters.rejected += 1;
        errors.push(
          stageError("fidibo-art", ref.sourceEventId, ref.url, "validate", "implausible dates"),
        );
        return;
      }
      const verification = await verifyFidibo(event, html, weekdayMismatches);
      tally(counters, (await persistEvent(event, verification, { dryRun: opts.dryRun, now })).action);
      if (verification.status === "conflict") counters.reviewQueued += 1;
    } catch (error) {
      counters.errors += 1;
      errors.push(stageError("fidibo-art", ref.sourceEventId, ref.url, "pipeline", error));
    }
  });

  const missing = await reconcileMissing("fidibo-art", seen, {
    dryRun: opts.dryRun,
    healthy: health.healthy && !opts.limit,
  });
  counters.missing = missing.missing;
  counters.unpublishedMissing = missing.unpublished;

  return {
    source: "fidibo-art",
    healthy: health.healthy,
    healthNote: health.note,
    counters,
    errors,
    durationMs: Date.now() - started,
  };
}

function tally(counters: SourceCounters, action: string): void {
  switch (action) {
    case "inserted": counters.new += 1; break;
    case "updated": counters.updated += 1; break;
    case "unchanged": counters.unchanged += 1; break;
    case "merged-cross-source": counters.mergedCrossSource += 1; break;
    case "skipped-finished": counters.finishedSkipped += 1; break;
    case "skipped-cancelled": counters.cancelledSkipped += 1; break;
    case "rejected": counters.rejected += 1; break;
    case "conflict": counters.conflicts += 1; break;
    default: counters.skippedOther += 1;
  }
}

export async function runSync(opts: SyncOptions): Promise<SyncReport> {
  const now = opts.now ?? new Date();
  const reports: SourceReport[] = [];

  for (const source of opts.sources) {
    const runRow = opts.dryRun
      ? null
      : await db.scrapeRun.create({
          data: { source: SOURCE_TO_DB[source], dryRun: opts.dryRun },
        });

    const report =
      source === "davvvat"
        ? await syncDavvvat(opts, now)
        : await syncFidibo(opts, now);
    reports.push(report);

    if (runRow) {
      try {
        await db.scrapeRun.update({
          where: { id: runRow.id },
          data: {
            status: report.healthy ? "ok" : "unhealthy",
            counters: report.counters as unknown as object,
            errors: report.errors as unknown as object,
            finishedAt: new Date(),
          },
        });
      } catch {
        // The row can vanish if someone reseeds the shared dev database
        // mid-run (prisma db seed TRUNCATEs every table). Losing one audit
        // row must not fail an otherwise-complete sync.
        slog({ stage: "sync", source, status: "audit-row-lost" });
      }
    }
    slog({
      stage: "sync",
      source,
      status: report.healthy ? "ok" : "unhealthy",
      duration_ms: report.durationMs,
      ...report.counters,
    });
  }

  // Lifecycle sweep runs regardless of crawl health — freshness must not
  // depend on the crawler being alive.
  const swept = await unpublishFinished({ dryRun: opts.dryRun, now });

  const publishedNow = await db.event.count({
    where: { importSources: { some: {} }, status: P.EventStatus.PUBLISHED },
  });

  return {
    dryRun: opts.dryRun,
    startedAt: now.toISOString(),
    sources: reports,
    lifecycleUnpublished: swept.unpublished,
    publishedNow,
  };
}

const SOURCE_LABELS: Record<SourceId, string> = {
  "davvvat": "DAVVVAT",
  "fidibo-art": "FIDIBO ART",
};

export function formatReport(report: SyncReport): string {
  const lines: string[] = [];
  lines.push("PosterUp Event Sync" + (report.dryRun ? " (dry run — nothing written)" : ""));
  lines.push("===================");
  for (const s of report.sources) {
    const c = s.counters;
    lines.push("");
    lines.push(SOURCE_LABELS[s.source] + (s.healthy ? "" : `  ⚠ UNHEALTHY: ${s.healthNote}`));
    lines.push("-".repeat(SOURCE_LABELS[s.source].length));
    const rows: [string, number][] = [
      ["Discovered", c.discovered],
      ["Parsed", c.parsed],
      ["New", c.new],
      ["Updated", c.updated],
      ["Unchanged", c.unchanged],
      ["Cross-source merges", c.mergedCrossSource],
      ["Finished (skipped)", c.finishedSkipped],
      ["Cancelled (skipped)", c.cancelledSkipped],
      ["Rejected", c.rejected],
      ["Verification conflicts", c.conflicts],
      ["Review queued", c.reviewQueued],
      ["Missing", c.missing],
      ["Unpublished (missing)", c.unpublishedMissing],
      ["Skipped (draft/private/…)", c.skippedOther],
      ["Errors", c.errors],
    ];
    for (const [label, value] of rows) {
      lines.push(`${label.padEnd(26)}${String(value).padStart(6)}`);
    }
  }
  lines.push("");
  lines.push("PUBLIC EVENTS");
  lines.push("-------------");
  lines.push(`Currently published       ${String(report.publishedNow).padStart(6)}`);
  lines.push(`Unpublished by lifecycle  ${String(report.lifecycleUnpublished).padStart(6)}`);
  return lines.join("\n");
}
