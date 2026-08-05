import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Suites that touch the database read DATABASE_URL from .env; without it
    // they skip themselves rather than fail.
    setupFiles: ["dotenv/config", "./tests/setup/cookies.ts"],
    // Those suites share one database, so let them run one file at a time
    // instead of interleaving writes.
    fileParallelism: false,
    /**
     * Vitest's 5 s default is a wall-clock limit, and most of these tests spend
     * their time waiting on Postgres. With a `next dev` server sharing the
     * machine, trivial cases — "404s an unknown token" — have timed out at 5 s
     * and then passed in 400 ms when run alone.
     *
     * This weakens no assertion: a test that is genuinely stuck still fails,
     * twenty seconds later. It removes a class of failure that says nothing
     * about the code.
     */
    testTimeout: 20_000,
    // Setup does more than a single case — an event, a ticket type, an order,
    // a settlement — so it gets more room. Observed: `ticket-design`'s
    // `beforeAll` takes 400 ms idle and was starved past 20 s at load average
    // 15, which reported all seven of its tests as *skipped* rather than
    // failed. Silently not running is the worst outcome of the three.
    hookTimeout: 45_000,
  },
});
