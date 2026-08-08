# Event scraper & sync

PosterUp republishes events from two external sources **with the explicit
permission of their business teams**:

| Source | URL | Data path |
| --- | --- | --- |
| Davvvat | https://davvvat.ir | `cms-api/events` REST API (primary) + detail-page JSON-LD (verification) |
| Fidibo Art | https://art.fidibo.com | `sitemap.xml` (discovery) + event JSON embedded in each page's RSC payload |

This is a **continuously synchronized catalog**, not a one-time import. The
optimization target is the number of *correct, verified, current, deduplicated*
events — never raw volume. When the pipeline is uncertain it rejects or queues
for review; it never guesses.

## Running

```bash
npm run scraper -- sync --dry-run        # full pipeline, writes nothing
npm run scraper -- sync                  # real sync, both sources
npm run scraper -- sync --source davvvat # one source (also: fidibo)
npm run scraper -- sync --limit 20       # cap discovery (missing-run logic disabled)
npm run scraper -- sync --json           # machine-readable report
npm run scraper -- lifecycle             # lifecycle sweep only — no network
npm run scraper -- report                # last stored runs
npm run scraper -- sources
```

`sync` is idempotent (rerunning an identical sync inserts nothing) and safe
under accidental concurrency — `UNIQUE(source, sourceEventId)` on
`EventSource` is the arbiter, not application logic. Recommended schedule:
**every 15–30 minutes** via cron/launchd (`*/20 * * * * cd … && npm run
scraper -- sync`); the repo has no scheduler of its own. `lifecycle` is free
of network and can run more often — it is what unpublishes finished events
even when crawling is broken.

## Pipeline

```
discover → parse → normalize → lifecycle gate → validate → verify → dedupe → persist
```

- **Lifecycle gate before persistence.** Finished/cancelled events are never
  *imported*; already-imported ones are flipped to `completed`/`cancelled`
  (unpublished). Date-only events: past day → finished, today → active today,
  future → upcoming. All day math is Asia/Tehran (fixed UTC+3:30; a unit test
  cross-checks the constant against Intl so a DST-law change screams).
- **Verification.** Davvvat: API doc vs the public page's JSON-LD (title,
  Tehran calendar day, venue, cancellation state) — disagreement becomes
  `verification_status = conflict`, a `ReviewItem`, and **no overwrite** of
  previously verified data. Fidibo: OG meta vs embedded payload, plus the
  per-session weekday cross-check (below). Deterministic 0–100 score; `< 70`
  or missing title/date → rejected, never imported.
- **Dedup.** Four levels: DB unique per source id → canonical URL →
  content fingerprint (folded title + Tehran day + venue + city) → fuzzy
  cross-source match. Confidence `≥ 0.95` with a shared calendar day merges
  into one Event with two `EventSource` rows; `0.80–0.95` imports separately
  **and** queues a `possible-duplicate` review; below stays separate.
  Thresholds live in `lib/scraper/dedupe.ts`.
- **Change tracking.** A SHA-256 content hash over the normalized meaningful
  fields decides "unchanged" (only `lastSeenAt` moves). Real changes diff
  into `EventSourceChange` (title, date, venue, price, status, ticket URL,
  poster).
- **Missing events.** An event not seen by a *healthy, uncapped* run
  increments `consecutiveMissingRuns`; at `MISSING_RUNS_BEFORE_UNPUBLISH`
  (default 3) it is unpublished and marked `missing`. Unhealthy runs never
  count absence.
- **Health checks.** A run is unhealthy when discovery falls under the
  configured floor or drops >50% versus the previous stored run — a layout or
  API change then fails loudly (exit code 1) instead of silently emptying the
  catalog.
- **Error isolation.** One broken event never stops a run; failures are
  recorded per event (source, id, url, stage, error) in `ScrapeRun.errors`.

## Source quirks (verified live, 2026-08-08 — do not "fix" without rechecking)

- **Davvvat timestamps are Tehran wall time with a fake `Z`.**
  `"2026-08-10T11:30:00.000Z"` means 11:30 in Tehran. The page JSON-LD is
  different again: date-only, encoded as Tehran-midnight-in-UTC. This is why
  verification compares Tehran calendar days, not instants.
- **`startDate === endDate` on Davvvat means "no stated end".** Stored as
  `EventSession.endAt = startAt` (the column is non-null); the truth is
  recoverable from `EventSource.rawData`. No end time is ever invented; an
  endless session counts as ongoing until its Tehran day ends.
- **Fidibo sessions are year-less Jalali** (`day: 18, month: "مرداد",
  week_day, time`). The year is inferred per session from its own
  `sales_started_at`/`visible_from`, then the stated weekday is checked
  against the inferred date. A contradiction drops the session and queues an
  `ambiguous-date` review — never a guess. Fidibo's `"70 دقیقه"` duration tag
  provides a real end time where present.
- **Fidibo prices are not importable** (they load per-session client-side, on
  paths its robots.txt disallows). Price fields stay null; the event's own
  page is the ticket link. Davvvat's `priceText` is free text and parsed
  conservatively — «به دایرکت برگزارکننده مراجعه فرمایید» yields no numbers.
- **Currency is stored as stated** (تومان vs ریال), never converted or
  assumed.

## Data model

Imported events are ordinary `Event`/`EventSession`/`Venue` rows owned by an
auto-created workspace per source (`davvvat`, `fidibo-art`), so every public
surface renders them. They have **no TicketType rows** — PosterUp displays,
the source sells. Scraper-specific state lives in:

- `EventSource` — provenance (`source`, `sourceEventId`, `sourceUrl`, raw
  payload), verification status/score/errors, display pricing,
  `externalTicketUrl`, missing-run bookkeeping. `@@unique([source,
  sourceEventId])`.
- `EventSourceChange` — field-level change history.
- `ScrapeRun` — one row per run: counters, per-event errors, health status.
- `ReviewItem` — manual queue (`conflict`, `possible-duplicate`,
  `ambiguous-date`), states `pending`/`approved`/`rejected`. Currently
  resolved directly in the database/Studio; no UI yet.

Publishing = the existing `EventStatus` machine: `published` only while
verified **and** upcoming/ongoing; `completed`/`cancelled`/`draft` otherwise.
Public queries already filter on status, so a stale crawler cannot keep a
finished event visible past the `lifecycle` sweep.

## Configuration

```env
# .env — never committed
DAVVVAT_TOKEN=      # davvvat_token cookie value (authorized credential)
DAVVVAT_SESSION=    # davvvat_session cookie value
SCRAPER_USER_AGENT=PosterUpBot/1.0 (authorized event sync)
SCRAPER_REQUESTS_PER_SECOND=1
SCRAPER_CONCURRENCY=2
SCRAPER_TIMEOUT_MS=15000
MISSING_RUNS_BEFORE_UNPUBLISH=3
SCRAPER_MIN_EXPECTED_DAVVVAT=50
SCRAPER_MIN_EXPECTED_FIDIBO=5
```

The Davvvat credential is a **user-session JWT that expires** (currently
2026-09-03; decode the token's `exp` to check). Event reads presently work
anonymously too, so an expired token degrades rather than breaks — but renew
it by pasting fresh cookie values into `.env`. Never commit, log, or fixture
the real values.

## Testing

```bash
npx vitest run tests/scraper     # unit + fixture + DB integration
```

Fixtures under `tests/scraper/fixtures/` are captured real responses; no test
touches the live sites. The integration suite (skipped without
`DATABASE_URL`) covers idempotent insert/update, change history, the
finished-import gate, cancellation, conflict-no-overwrite, cross-source
merge, dry-run purity, the missing-runs policy, the unhealthy-run guard, and
the lifecycle sweep.

## Adding a source

Write `lib/scraper/sources/<name>.ts` exporting discover/parse/verify that
produce `CanonicalEvent`s (see `lib/scraper/types.ts`), add the source to the
`ScrapeSource` enum + `SOURCE_TO_DB` + workspace spec in `persist.ts`, wire a
`sync<Name>` in `sync.ts`, and capture fixtures. Nothing in
normalize/lifecycle/dedupe/persist should need touching — that separation is
the point.

## Troubleshooting

- **Run exits 1 / "UNHEALTHY"** — discovery collapsed (site change or
  outage). Nothing was unpublished for absence; inspect
  `npm run scraper -- report` and the site by hand.
- **Persian dates look off by a year** — check the session's
  `sales_started_at` hint; the weekday cross-check should have caught it
  (look for `ambiguous-date` review items).
- **Everything conflicts on Davvvat** — the fake-`Z` convention may have been
  fixed upstream to real UTC. Re-verify against a rendered page before
  touching `fakeZTehranToUtc`.
- **`DATABASE_URL is not set`** — the CLI loads `.env` via dotenv; run from
  the repo root.
