// Prisma 7 no longer reads `.env` itself, and the CLI runs outside Next's
// env loading — so load it here or every command sees an empty DATABASE_URL.
import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 keeps connection URLs out of `schema.prisma`.
 *
 * With a driver adapter there is no separate `directUrl`: migrations and the
 * runtime both use `DATABASE_URL`. If the provider hands out a pooled and a
 * direct URL, point this at the direct one and give the pooled string to the
 * adapter in `lib/server/db.ts`.
 *
 * The URL is read with `??` rather than Prisma's `env()` helper, which throws
 * when the variable is missing. `prisma generate` runs on `postinstall` and
 * needs no database, so a fresh clone must still install and build; commands
 * that do need a connection fail on their own, and `lib/server/db.ts` raises a
 * clear error at runtime.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
