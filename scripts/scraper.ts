/**
 * PosterUp event scraper CLI.
 *
 *   npm run scraper -- sync [--source davvvat|fidibo] [--dry-run] [--limit N] [--json]
 *   npm run scraper -- lifecycle [--dry-run]     lifecycle sweep only (no network)
 *   npm run scraper -- report                    last run per source
 *   npm run scraper -- sources                   list sources
 *
 * `sync` is idempotent and safe on any schedule (recommended: 15–30 min).
 * See docs/scraper.md.
 */

import "dotenv/config";
import { parseArgs } from "node:util";

import { db } from "@/lib/server/db";
import { formatReport, runSync } from "@/lib/scraper/sync";
import { unpublishFinished } from "@/lib/scraper/persist";
import type { SourceId } from "@/lib/scraper/types";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    "source": { type: "string" },
    "dry-run": { type: "boolean", default: false },
    "limit": { type: "string" },
    "json": { type: "boolean", default: false },
    "full": { type: "boolean", default: false }, // alias of default behaviour
  },
});

const command = positionals[0] ?? "sync";

function resolveSources(): SourceId[] {
  const flag = values.source;
  if (!flag) return ["davvvat", "fidibo-art"];
  const map: Record<string, SourceId> = {
    "davvvat": "davvvat",
    "fidibo": "fidibo-art",
    "fidibo-art": "fidibo-art",
  };
  const source = map[flag];
  if (!source) {
    console.error(`unknown source «${flag}» — use: davvvat | fidibo`);
    process.exit(2);
  }
  return [source];
}

async function main(): Promise<void> {
  switch (command) {
    case "sources": {
      console.log("davvvat      https://davvvat.ir        (cms-api + JSON-LD verification)");
      console.log("fidibo-art   https://art.fidibo.com    (sitemap + embedded payload)");
      return;
    }

    case "sync":
    case "run": {
      const report = await runSync({
        sources: resolveSources(),
        dryRun: values["dry-run"],
        limit: values.limit ? Number(values.limit) : undefined,
      });
      console.log(values.json ? JSON.stringify(report, null, 2) : formatReport(report));
      const unhealthy = report.sources.some((s) => !s.healthy);
      if (unhealthy) process.exitCode = 1;
      return;
    }

    case "lifecycle": {
      const swept = await unpublishFinished({
        dryRun: values["dry-run"],
        now: new Date(),
      });
      console.log(`unpublished ${swept.unpublished} finished/cancelled event(s)`);
      return;
    }

    case "report": {
      const runs = await db.scrapeRun.findMany({
        orderBy: { startedAt: "desc" },
        take: 10,
      });
      if (values.json) {
        console.log(JSON.stringify(runs, null, 2));
        return;
      }
      for (const run of runs) {
        console.log(
          `${run.startedAt.toISOString()}  ${run.source.padEnd(11)} ${run.status.padEnd(10)}` +
            ` ${JSON.stringify(run.counters)}`,
        );
      }
      return;
    }

    default: {
      console.error(`unknown command «${command}» — use: sync | lifecycle | report | sources`);
      process.exit(2);
    }
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
