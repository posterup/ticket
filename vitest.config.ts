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
  },
});
