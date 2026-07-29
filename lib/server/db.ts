/**
 * Prisma client singleton.
 *
 * Next's dev server re-evaluates modules on every hot reload, which would
 * otherwise open a new connection pool each time until Postgres refuses more.
 * Stashing the client on `globalThis` keeps one pool per process.
 *
 * The client is created lazily, on first use rather than on import. Importing
 * `lib/server` must not require a database — the production build traces these
 * modules, and test files that never touch the database still import them.
 * A missing `DATABASE_URL` therefore fails at the first query, with a message
 * that says what to do, instead of at module load.
 */

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Provision a database and add it to .env — see README.",
    );
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function client(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing) return existing;

  const created = createClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = created;
  }
  return created;
}

/**
 * The Prisma client. A proxy so the connection is opened on first property
 * access — `db.event.findMany(…)` — not when this module is imported.
 */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    return Reflect.get(client(), property, receiver);
  },
});
