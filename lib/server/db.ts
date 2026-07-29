/**
 * Prisma client singleton.
 *
 * Next's dev server re-evaluates modules on every hot reload, which would
 * otherwise open a new connection pool each time until Postgres refuses more.
 * Stashing the client on `globalThis` keeps one pool per process.
 *
 * `DATABASE_URL` should be the pooled connection string; `DIRECT_URL` is used
 * only by migrations (see `prisma.config.ts`).
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
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

export const db: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
