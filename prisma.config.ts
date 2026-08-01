// Prisma 7 no longer reads `.env` itself, and the CLI runs outside Next's
// env loading — so load it here or every command sees an empty DATABASE_URL.
import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 keeps connection URLs out of `schema.prisma`.
 *
 * With a driver adapter there is no separate `directUrl`, so this is where the
 * pooled/direct split is made: **migrations take the direct URL**, while
 * `lib/server/db.ts` gives the pooled one to the adapter.
 *
 * That split is not cosmetic. A migration through PgBouncer in transaction mode
 * loses the session state DDL depends on — advisory locks, `SET`s, prepared
 * statements — and fails or, worse, half-applies. `DATABASE_URL_UNPOOLED` is
 * the name Neon and the Vercel integration both set for the direct string;
 * falling back to `DATABASE_URL` keeps a plain local Postgres working, where
 * there is only one URL and no pooler in front of it.
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
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
