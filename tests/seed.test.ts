// vitest does not load .env, and this suite keys off DATABASE_URL.
import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/client";
import {
  events,
  ticketTypes,
  attendees,
  eventGuests,
  eventRegistrations,
  eventCollaborators,
  workspaces as workspaceFixtures,
  EVENT_WORKSPACE,
  discounts as discountFixtures,
  ENGAGEMENT,
} from "@/prisma/seed-data";

/**
 * Verifies the seed reproduces every fixture — same ids, same values, same
 * ownership. Assertions are supersets rather than exact counts because the API
 * suites share this database and add rows of their own; what matters is that
 * nothing seeded went missing or got renumbered. That fidelity is the whole point: tests and other
 * fixtures reference these ids by hand, so a seed that quietly renumbered
 * anything would break them far from the cause.
 *
 * Skipped without DATABASE_URL so `npm test` stays green on a fresh clone and
 * in CI. Run `npm run db:reset` first to exercise it.
 */
const connectionString = process.env.DATABASE_URL;

const db = connectionString
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  : null;

afterAll(async () => {
  await db?.$disconnect();
});

describe.skipIf(!db)("seeded database matches the fixtures", () => {
  it("has every event, by id", async () => {
    const rows = await db!.event.findMany({ select: { id: true } });
    const present = new Set(rows.map((r) => r.id));
    // A superset, not an exact match: the API suites create events too.
    for (const e of events) expect(present.has(e.id)).toBe(true);
  });

  it("has every session, with ids preserved and unique", async () => {
    const fixture = events.flatMap((e) => e.sessions);
    const rows = await db!.eventSession.findMany({
      select: { id: true, eventId: true },
    });
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    const present = new Set(rows.map((r) => r.id));
    for (const s of fixture) expect(present.has(s.id)).toBe(true);
  });

  it("keeps each session under its own event", async () => {
    const rows = await db!.eventSession.findMany({
      select: { id: true, eventId: true },
    });
    const expected = new Map(
      events.flatMap((e) => e.sessions.map((s) => [s.id, e.id] as const)),
    );
    for (const row of rows) {
      const owner = expected.get(row.id);
      if (owner) expect(row.eventId).toBe(owner);
    }
  });

  it("has every ticket type, with prices intact", async () => {
    const rows = await db!.ticketType.findMany({
      select: { id: true, price: true, capacity: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const t of ticketTypes) {
      // Money is integer Toman on both sides — no unit drift.
      expect(byId.get(t.id)?.price).toBe(t.price);
      expect(byId.get(t.id)?.capacity).toBe(t.capacity);
    }
  });

  it("gives every event the workspace that owned it in the fixtures", async () => {
    const slugByEvent = new Map<string, string>();
    for (const [slug, ids] of Object.entries(EVENT_WORKSPACE)) {
      for (const id of ids) slugByEvent.set(id, slug);
    }
    const rows = await db!.event.findMany({
      select: { id: true, workspace: { select: { slug: true } } },
    });
    for (const row of rows) {
      // Only the mapped fixtures — events created by the API suites take a
      // fallback owner, which is not what this is checking.
      const slug = slugByEvent.get(row.id);
      if (slug) expect(row.workspace.slug).toBe(slug);
    }
  });

  it("preserves the seeded engagement baseline", async () => {
    const rows = await db!.event.findMany({
      select: { id: true, seedGoing: true, seedInterested: true },
    });
    for (const row of rows) {
      const engagement = ENGAGEMENT[row.id] ?? { going: 0, interested: 0 };
      expect(row.seedGoing).toBe(engagement.going);
      expect(row.seedInterested).toBe(engagement.interested);
    }
  });

  it("preserves workspace follower counts", async () => {
    const fixtures = workspaceFixtures;
    const rows = await db!.workspace.findMany({
      select: { slug: true, seedFollowers: true, seedFollowing: true },
    });
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    for (const w of fixtures) {
      expect(bySlug.get(w.slug)?.seedFollowers).toBe(w.followers);
      expect(bySlug.get(w.slug)?.seedFollowing).toBe(w.following);
    }
  });

  it("has the discount codes, upper-cased, with redemption counts", async () => {
    const fixtures = discountFixtures;
    const rows = await db!.discountCode.findMany({
      select: { id: true, code: true, redemptions: true, workspaceId: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const d of fixtures) {
      expect(byId.get(d.id)?.code).toBe(d.code.toUpperCase());
      // A floor, not an equality: settling an order legitimately increments
      // this, and the order suite shares the database.
      expect(byId.get(d.id)?.redemptions).toBeGreaterThanOrEqual(d.redemptions);
      // Every code is scoped to a workspace, including the org-wide ones.
      expect(byId.get(d.id)?.workspaceId).toBeTruthy();
    }
  });

  it("has the guests, registrations and collaborators", async () => {
    expect(await db!.eventGuest.count()).toBeGreaterThanOrEqual(eventGuests.length);
    expect(await db!.eventRegistration.count()).toBeGreaterThanOrEqual(
      eventRegistrations.length,
    );
    expect(await db!.eventCollaborator.count()).toBeGreaterThanOrEqual(
      eventCollaborators.length,
    );
  });

  it("scopes every CRM contact to a workspace", async () => {
    const rows = await db!.attendee.findMany({
      select: { id: true, workspaceId: true, tags: true },
    });
    const present = new Set(rows.map((r) => r.id));
    for (const a of attendees) expect(present.has(a.id)).toBe(true);
    for (const row of rows) {
      expect(row.workspaceId).toBeTruthy();
    }
    // Tags survived as links, not as free-form strings.
    expect(rows.some((r) => r.tags.length > 0)).toBe(true);
  });

  it("gives every workspace an owner who can sign in", async () => {
    const members = await db!.workspaceMember.findMany({
      where: { role: "OWNER" },
      select: { workspace: { select: { slug: true } }, user: { select: { phone: true } } },
    });
    expect(members.length).toBeGreaterThanOrEqual(workspaceFixtures.length);
    for (const m of members) {
      expect(m.user.phone).toMatch(/^09\d{9}$/);
    }
  });

  it("resolves an accepted collaborator to a real workspace", async () => {
    // An unresolved invite grants nothing, so the seed must resolve the ones
    // that name a workspace.
    const withSlug = await db!.eventCollaborator.findMany({
      where: { workspaceSlug: { not: null } },
      select: { workspaceSlug: true, inviteeWorkspaceId: true },
    });
    for (const row of withSlug) {
      expect(row.inviteeWorkspaceId).toBeTruthy();
    }
  });
});
