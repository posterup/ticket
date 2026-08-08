/**
 * Integration tests for the scraper persistence layer, against the seeded
 * database like tests/api. Each canonical event uses unique source ids so
 * reruns never collide; created rows are cleaned up per suite.
 */

import { afterAll, describe, expect, it } from "vitest";

import * as P from "@/generated/enums";
import { db } from "@/lib/server/db";
import {
  persistEvent,
  reconcileMissing,
  unpublishFinished,
} from "@/lib/scraper/persist";
import { eventLifecycle, sessionLifecycle } from "@/lib/scraper/lifecycle";
import {
  contentHash,
  fingerprint,
  matchConfidence,
  titleSimilarity,
} from "@/lib/scraper/dedupe";
import type { CanonicalEvent, VerificationResult } from "@/lib/scraper/types";

const describeDb = describe.skipIf(!process.env.DATABASE_URL);

const NOW = new Date("2026-08-08T12:00:00Z");
const RUN = `t${Date.now().toString(36)}`;
let seq = 0;

function makeEvent(overrides: Partial<CanonicalEvent> = {}): CanonicalEvent {
  seq += 1;
  return {
    source: "davvvat",
    sourceEventId: `${RUN}-${seq}`,
    sourceUrl: `https://davvvat.ir/event/${RUN}-${seq}`,
    title: `رویداد آزمایشی ${RUN} ${seq}`,
    description: "توضیح آزمایشی به اندازه کافی بلند برای اعتبارسنجی.",
    categories: ["workshop"],
    sourceCategories: ["learning-skill"],
    city: "تهران",
    venueName: "سالن آزمایشی",
    address: "خیابان آزمایش",
    latitude: null,
    longitude: null,
    organizerName: null,
    sessions: [
      {
        startAt: new Date("2026-08-20T14:30:00Z"),
        endAt: null,
        dateOnly: false,
        cancelled: false,
        soldOut: false,
        sourceStatus: "published",
      },
    ],
    sourceStatus: "published",
    soldOut: false,
    posterUrl: "https://example.com/poster.webp",
    price: { min: 100_000, max: 100_000, currency: "تومان", isFree: false, text: "۱۰۰٬۰۰۰ تومان" },
    externalTicketUrl: "https://davvvat.ir/event/x",
    raw: { test: true },
    ...overrides,
  };
}

const verified: VerificationResult = {
  status: "verified",
  score: 95,
  errors: [],
  checks: {},
};

const OPTS = { dryRun: false, now: NOW };

describe("lifecycle (pure)", () => {
  const base = makeEvent();

  it("upcoming / ongoing / finished by Tehran clock", () => {
    const s = base.sessions[0];
    expect(sessionLifecycle(s, new Date("2026-08-10T00:00:00Z"))).toBe("upcoming");
    expect(sessionLifecycle(s, new Date("2026-08-20T15:00:00Z"))).toBe("ongoing");
    // No stated end → ongoing until the Tehran day ends (20:30 UTC).
    expect(sessionLifecycle(s, new Date("2026-08-20T20:00:00Z"))).toBe("ongoing");
    expect(sessionLifecycle(s, new Date("2026-08-20T21:00:00Z"))).toBe("finished");
  });

  it("source-stated status beats the clock", () => {
    expect(
      sessionLifecycle({ ...base.sessions[0], sourceStatus: "finished" }, NOW),
    ).toBe("finished");
  });

  it("date-only sessions use day granularity", () => {
    const s = { ...base.sessions[0], dateOnly: true, startAt: new Date("2026-08-07T20:30:00Z") };
    // 2026-08-07T20:30Z = Tehran midnight of Aug 8 → "today" on Aug 8.
    expect(sessionLifecycle(s, NOW)).toBe("ongoing");
    expect(sessionLifecycle(s, new Date("2026-08-09T12:00:00Z"))).toBe("finished");
  });

  it("event-level: any live session keeps the event alive", () => {
    const e = makeEvent({
      sessions: [
        { ...base.sessions[0], startAt: new Date("2026-08-01T14:00:00Z"), sourceStatus: "finished" },
        { ...base.sessions[0], startAt: new Date("2026-08-20T14:00:00Z") },
      ],
    });
    expect(eventLifecycle(e, NOW)).toBe("upcoming");
  });
});

describe("dedupe (pure)", () => {
  it("fingerprint is stable across cosmetic differences", () => {
    const a = makeEvent({ title: "نمایشِ «تاوان»" });
    const b = { ...a, title: "نمایش تاوان" };
    expect(fingerprint(a)).toBe(fingerprint(b));
  });

  it("contentHash moves when meaningful fields move", () => {
    const a = makeEvent();
    expect(contentHash(a)).toBe(contentHash({ ...a }));
    expect(contentHash(a)).not.toBe(contentHash({ ...a, title: a.title + " ۲" }));
  });

  it("title containment scores as near-duplicate", () => {
    expect(titleSimilarity("نمایش شازده کوچولو", "شازده کوچولو")).toBeGreaterThanOrEqual(0.9);
    expect(titleSimilarity("شب شعر", "کنسرت راک")).toBeLessThan(0.3);
  });

  it("same title+day+venue+city crosses the merge threshold; different city does not", () => {
    const e = makeEvent({ title: "شازده کوچولو" });
    const match = {
      title: "نمایش شازده کوچولو",
      venueName: e.venueName,
      city: "تهران",
      days: ["2026-08-20"],
    };
    expect(matchConfidence(e, match)).toBeGreaterThanOrEqual(0.9);
    expect(matchConfidence(e, { ...match, city: "شیراز" })).toBeLessThan(0.9);
    expect(matchConfidence(e, { ...match, days: ["2026-09-01"] })).toBe(0);
  });
});

describeDb("persistEvent", () => {
  const created: string[] = [];

  afterAll(async () => {
    await db.event.deleteMany({
      where: { importSources: { some: { sourceEventId: { startsWith: RUN } } } },
    });
    await db.reviewItem.deleteMany({});
  });

  it("insert → idempotent rerun → update, with change history", async () => {
    const e = makeEvent();
    const first = await persistEvent(e, verified, OPTS);
    expect(first.action).toBe("inserted");
    created.push(first.eventId!);

    // Same content again: no write beyond lastSeenAt.
    const second = await persistEvent(e, verified, OPTS);
    expect(second.action).toBe("unchanged");
    expect(second.eventId).toBe(first.eventId);

    // Changed price → update + history row.
    const changed: CanonicalEvent = {
      ...e,
      price: { ...e.price, min: 200_000, max: 200_000, text: "۲۰۰٬۰۰۰ تومان" },
    };
    const third = await persistEvent(changed, verified, OPTS);
    expect(third.action).toBe("updated");

    const source = await db.eventSource.findUnique({
      where: {
        source_sourceEventId: {
          source: P.ScrapeSource.DAVVVAT,
          sourceEventId: e.sourceEventId,
        },
      },
      include: { changes: true },
    });
    expect(source?.priceMin).toBe(200_000);
    expect(source?.changes.some((c) => c.field === "priceText")).toBe(true);

    const event = await db.event.findUnique({
      where: { id: first.eventId },
      include: { sessions: true, workspace: true },
    });
    expect(event?.status).toBe(P.EventStatus.PUBLISHED);
    expect(event?.workspace.slug).toBe("davvvat");
    expect(event?.sessions).toHaveLength(1);
    // No stated end → endAt === startAt sentinel, never an invented time.
    expect(event?.sessions[0].endAt.getTime()).toBe(
      event?.sessions[0].startAt.getTime(),
    );
  });

  it("never imports a finished event", async () => {
    const e = makeEvent({
      sessions: [
        {
          startAt: new Date("2026-07-01T14:30:00Z"),
          endAt: null,
          dateOnly: false,
          cancelled: false,
          soldOut: false,
          sourceStatus: null,
        },
      ],
    });
    const out = await persistEvent(e, verified, OPTS);
    expect(out.action).toBe("skipped-finished");
    const row = await db.eventSource.findUnique({
      where: {
        source_sourceEventId: {
          source: P.ScrapeSource.DAVVVAT,
          sourceEventId: e.sourceEventId,
        },
      },
    });
    expect(row).toBeNull();
  });

  it("finishes an already-imported event instead of keeping it public", async () => {
    const e = makeEvent();
    const first = await persistEvent(e, verified, OPTS);
    created.push(first.eventId!);

    // Same event later, now past.
    const later = { dryRun: false, now: new Date("2026-09-01T12:00:00Z") };
    const out = await persistEvent(e, verified, later);
    expect(out.action).toBe("updated");
    const event = await db.event.findUnique({ where: { id: first.eventId } });
    expect(event?.status).toBe(P.EventStatus.COMPLETED);
  });

  it("cancellation unpublishes", async () => {
    const e = makeEvent();
    const first = await persistEvent(e, verified, OPTS);
    created.push(first.eventId!);
    const out = await persistEvent(
      { ...e, sourceStatus: "cancelled" },
      verified,
      OPTS,
    );
    expect(out.lifecycle).toBe("cancelled");
    const event = await db.event.findUnique({ where: { id: first.eventId } });
    expect(event?.status).toBe(P.EventStatus.CANCELLED);
  });

  it("conflict never overwrites, lands in review", async () => {
    const e = makeEvent();
    const first = await persistEvent(e, verified, OPTS);
    created.push(first.eventId!);
    const out = await persistEvent(
      { ...e, title: e.title + " متفاوت" },
      { status: "conflict", score: 60, errors: ["title differs"], checks: {} },
      OPTS,
    );
    expect(out.action).toBe("conflict");
    const event = await db.event.findUnique({ where: { id: first.eventId } });
    expect(event?.title).toBe(e.title); // untouched
    const review = await db.reviewItem.findFirst({ where: { kind: "conflict" } });
    expect(review).not.toBeNull();
  });

  it("merges a high-confidence cross-source duplicate into one Event", async () => {
    const dv = makeEvent({ title: "نمایش شازده کوچولو" });
    const first = await persistEvent(dv, verified, OPTS);
    created.push(first.eventId!);

    const fb = makeEvent({
      source: "fidibo-art",
      title: "شازده کوچولو",
      sourceUrl: "https://art.fidibo.com/theater/x-1",
    });
    const out = await persistEvent(fb, verified, OPTS);
    expect(out.action).toBe("merged-cross-source");
    expect(out.eventId).toBe(first.eventId);

    const sources = await db.eventSource.findMany({
      where: { eventId: first.eventId },
    });
    expect(sources.map((s) => s.source).sort()).toEqual([
      P.ScrapeSource.DAVVVAT,
      P.ScrapeSource.FIDIBO_ART,
    ]);
  });

  it("dry-run writes nothing", async () => {
    const e = makeEvent();
    const out = await persistEvent(e, verified, { dryRun: true, now: NOW });
    expect(out.action).toBe("inserted");
    const row = await db.eventSource.findUnique({
      where: {
        source_sourceEventId: {
          source: P.ScrapeSource.DAVVVAT,
          sourceEventId: e.sourceEventId,
        },
      },
    });
    expect(row).toBeNull();
  });

  it("missing-runs policy: below threshold stays, at threshold unpublishes", async () => {
    const e = makeEvent();
    const first = await persistEvent(e, verified, OPTS);
    created.push(first.eventId!);

    for (let run = 1; run <= 3; run++) {
      await reconcileMissing("davvvat", new Set(), { dryRun: false, healthy: true });
      const event = await db.event.findUnique({ where: { id: first.eventId } });
      if (run < 3) expect(event?.status).toBe(P.EventStatus.PUBLISHED);
      else expect(event?.status).toBe(P.EventStatus.DRAFT);
    }
    const row = await db.eventSource.findUnique({
      where: {
        source_sourceEventId: {
          source: P.ScrapeSource.DAVVVAT,
          sourceEventId: e.sourceEventId,
        },
      },
    });
    expect(row?.sourceStatus).toBe(P.SourceStatus.MISSING);
  });

  it("unhealthy runs never count as missing", async () => {
    const e = makeEvent();
    const first = await persistEvent(e, verified, OPTS);
    created.push(first.eventId!);
    const out = await reconcileMissing("davvvat", new Set(), {
      dryRun: false,
      healthy: false,
    });
    expect(out).toEqual({ missing: 0, unpublished: 0 });
    const event = await db.event.findUnique({ where: { id: first.eventId } });
    expect(event?.status).toBe(P.EventStatus.PUBLISHED);
  });

  it("lifecycle sweep unpublishes an event whose sessions are all over", async () => {
    const e = makeEvent();
    const first = await persistEvent(e, verified, OPTS);
    created.push(first.eventId!);
    const swept = await unpublishFinished({
      dryRun: false,
      now: new Date("2026-09-15T12:00:00Z"),
    });
    expect(swept.unpublished).toBeGreaterThanOrEqual(1);
    const event = await db.event.findUnique({ where: { id: first.eventId } });
    expect(event?.status).toBe(P.EventStatus.COMPLETED);
  });
});
