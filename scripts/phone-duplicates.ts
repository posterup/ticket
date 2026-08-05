/**
 * Read-only report: which contacts a phone-normalisation backfill would merge.
 *
 *   npx tsx scripts/phone-duplicates.ts
 *
 * `Attendee.phone` and `EventRegistration.phone` were written exactly as typed
 * until the write paths were normalised, and the zod schema accepts `09…`,
 * `+989…` and `989…` alike. So one person can hold several rows in one
 * workspace, splitting their tags, their history and their segment membership.
 *
 * A migration that simply normalises the column would hit the
 * `workspaceId_phone` unique constraint the moment two spellings of the same
 * number exist side by side, and a migration that resolves that by deleting is
 * throwing away an organiser's CRM. So the merge has to be written knowing what
 * it will meet: this prints exactly that, changes nothing, and is safe to run
 * against production.
 *
 * Deliberately not a migration. Writing destructive SQL against data nobody has
 * looked at is how a backfill turns into an incident.
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/client";
import { normalizeMobile } from "@/lib/server/sms";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Group rows by (workspace, canonical phone) and keep the collisions. */
function collisions<T extends { phone: string }>(
  rows: T[],
  keyOf: (row: T) => string,
): Map<string, T[]> {
  const byKey = new Map<string, T[]>();
  for (const row of rows) {
    const key = `${keyOf(row)}|${normalizeMobile(row.phone)}`;
    byKey.set(key, [...(byKey.get(key) ?? []), row]);
  }
  return new Map([...byKey].filter(([, group]) => group.length > 1));
}

async function main() {
  const attendees = await db.attendee.findMany({
    select: {
      id: true,
      workspaceId: true,
      phone: true,
      fullName: true,
      createdAt: true,
      _count: { select: { tags: true, orders: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const dupes = collisions(attendees, (a) => a.workspaceId);

  console.log(`Attendee rows:            ${attendees.length}`);
  console.log(`Distinct people:          ${attendees.length - [...dupes.values()].reduce((n, g) => n + g.length - 1, 0)}`);
  console.log(`Groups needing a merge:   ${dupes.size}`);

  /** A row's format, so the report says which spellings are actually in use. */
  const shape = (phone: string) =>
    phone.startsWith("+98") ? "+98…" : phone.startsWith("98") ? "98…" : phone.startsWith("0") ? "09…" : "other";

  const shapes = new Map<string, number>();
  for (const a of attendees) shapes.set(shape(a.phone), (shapes.get(shape(a.phone)) ?? 0) + 1);
  console.log("\nFormats in use:");
  for (const [s, n] of [...shapes].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${s.padEnd(6)} ${n}`);
  }

  if (dupes.size) {
    console.log("\nGroups (oldest first — the survivor, if merging by age):");
    for (const [key, group] of dupes) {
      const [, canonical] = key.split("|");
      console.log(`\n  ${canonical}  (workspace ${group[0].workspaceId.slice(0, 8)}…)`);
      for (const a of group) {
        console.log(
          `    ${a.id.slice(0, 8)}…  ${a.phone.padEnd(15)} ${a.fullName.padEnd(20)}` +
            `  tags:${a._count.tags}  orders:${a._count.orders}  ${a.createdAt.toISOString().slice(0, 10)}`,
        );
      }
    }
    console.log(
      "\nA merge must carry tags, orders and notes onto the survivor before deleting.\n" +
        "The `orders:` and `tags:` counts above are what would be orphaned by a naive delete.",
    );
  }

  const registrations = await db.eventRegistration.findMany({
    select: { id: true, eventId: true, phone: true, status: true },
  });
  const regDupes = collisions(registrations, (r) => r.eventId);
  console.log(`\nRegistration rows:        ${registrations.length}`);
  console.log(`Groups needing a merge:   ${regDupes.size}`);
  for (const [key, group] of regDupes) {
    const [, canonical] = key.split("|");
    console.log(
      `  ${canonical}: ${group.map((r) => `${r.phone}(${r.status})`).join(", ")}`,
    );
  }

  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
