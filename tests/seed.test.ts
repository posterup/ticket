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
} from "@/lib/server/store";
import { listWorkspaces, getWorkspaceByEvent } from "@/lib/server/workspaces";
import { getEventEngagement } from "@/lib/server/engagement";
import { listDiscounts } from "@/lib/server/discounts";

/**
 * Verifies the seed reproduces the in-memory fixtures exactly — same ids, same
 * counts, same ownership. That fidelity is the whole point: tests and other
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
    expect(rows).toHaveLength(events.length);
    expect(new Set(rows.map((r) => r.id))).toEqual(
      new Set(events.map((e) => e.id)),
    );
  });

  it("has every session, with ids preserved and unique", async () => {
    const fixture = events.flatMap((e) => e.sessions);
    const rows = await db!.eventSession.findMany({
      select: { id: true, eventId: true },
    });
    expect(rows).toHaveLength(fixture.length);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(new Set(rows.map((r) => r.id))).toEqual(
      new Set(fixture.map((s) => s.id)),
    );
  });

  it("keeps each session under its own event", async () => {
    const rows = await db!.eventSession.findMany({
      select: { id: true, eventId: true },
    });
    const expected = new Map(
      events.flatMap((e) => e.sessions.map((s) => [s.id, e.id] as const)),
    );
    for (const row of rows) {
      expect(row.eventId).toBe(expected.get(row.id));
    }
  });

  it("has every ticket type, with prices intact", async () => {
    const rows = await db!.ticketType.findMany({
      select: { id: true, price: true, capacity: true },
    });
    expect(rows).toHaveLength(ticketTypes.length);
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const t of ticketTypes) {
      // Money is integer Toman on both sides — no unit drift.
      expect(byId.get(t.id)?.price).toBe(t.price);
      expect(byId.get(t.id)?.capacity).toBe(t.capacity);
    }
  });

  it("gives every event the workspace that owned it in the fixtures", async () => {
    const rows = await db!.event.findMany({
      select: { id: true, workspace: { select: { slug: true } } },
    });
    for (const row of rows) {
      const owner = await getWorkspaceByEvent(row.id);
      expect(row.workspace.slug).toBe(owner?.slug);
    }
  });

  it("preserves the seeded engagement baseline", async () => {
    const rows = await db!.event.findMany({
      select: { id: true, seedGoing: true, seedInterested: true },
    });
    for (const row of rows) {
      const engagement = await getEventEngagement(row.id);
      expect(row.seedGoing).toBe(engagement.going);
      expect(row.seedInterested).toBe(engagement.interested);
    }
  });

  it("preserves workspace follower counts", async () => {
    const fixtures = await listWorkspaces();
    const rows = await db!.workspace.findMany({
      select: { slug: true, seedFollowers: true, seedFollowing: true },
    });
    expect(rows).toHaveLength(fixtures.length);
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    for (const w of fixtures) {
      expect(bySlug.get(w.slug)?.seedFollowers).toBe(w.followers);
      expect(bySlug.get(w.slug)?.seedFollowing).toBe(w.following);
    }
  });

  it("has the discount codes, upper-cased, with redemption counts", async () => {
    const fixtures = await listDiscounts();
    const rows = await db!.discountCode.findMany({
      select: { id: true, code: true, redemptions: true, workspaceId: true },
    });
    expect(rows).toHaveLength(fixtures.length);
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const d of fixtures) {
      expect(byId.get(d.id)?.code).toBe(d.code.toUpperCase());
      expect(byId.get(d.id)?.redemptions).toBe(d.redemptions);
      // Every code is scoped to a workspace, including the org-wide ones.
      expect(byId.get(d.id)?.workspaceId).toBeTruthy();
    }
  });

  it("has the guests, registrations and collaborators", async () => {
    expect(await db!.eventGuest.count()).toBe(eventGuests.length);
    expect(await db!.eventRegistration.count()).toBe(eventRegistrations.length);
    expect(await db!.eventCollaborator.count()).toBe(eventCollaborators.length);
  });

  it("scopes every CRM contact to a workspace", async () => {
    const rows = await db!.attendee.findMany({
      select: { id: true, workspaceId: true, tags: true },
    });
    expect(rows).toHaveLength(attendees.length);
    for (const row of rows) {
      expect(row.workspaceId).toBeTruthy();
    }
    // Tags survived as links, not as free-form strings.
    const tagged = attendees.filter((a) => a.tags.length > 0).length;
    expect(rows.filter((r) => r.tags.length > 0)).toHaveLength(tagged);
  });

  it("gives every workspace an owner who can sign in", async () => {
    const members = await db!.workspaceMember.findMany({
      where: { role: "OWNER" },
      select: { workspace: { select: { slug: true } }, user: { select: { phone: true } } },
    });
    const workspaces = await listWorkspaces();
    expect(members).toHaveLength(workspaces.length);
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
