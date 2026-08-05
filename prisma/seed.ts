/**
 * Seed the database from the in-memory fixtures.
 *
 * Reads the existing seed arrays and writes them to Postgres **preserving every
 * hardcoded id** — they are cross-referenced by other fixtures and by tests
 * (`tests/api/*` assert against `3f1a6c2e-0001-…`), so a fresh `db:reset` must
 * produce a database indistinguishable from the arrays it replaced.
 *
 * Deliberately reads the raw arrays rather than `listEvents()`: that helper
 * hides recurring events while calendar mode is off, which would silently drop
 * two events and their ownership. `getWorkspaceByEvent` and
 * `getEventEngagement` read their maps directly and are safe.
 *
 * Orders and issued tickets are not seeded here — they arrive with the
 * checkout work, which is what makes them real.
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/client";
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
  campaigns as campaignFixtures,
  ENGAGEMENT,
} from "./seed-data";
import {
  COLLABORATOR_CHANNEL_TO_DB,
  COLLABORATOR_STATUS_TO_DB,
  COLLAB_ROLE_TO_DB,
  DISCOUNT_KIND_TO_DB,
  EVENT_MODE_TO_DB,
  EVENT_STATUS_TO_DB,
  EVENT_VISIBILITY_TO_DB,
  GUEST_RSVP_TO_DB,
  REGISTRATION_STATUS_TO_DB,
  SESSION_AVAILABILITY_TO_DB,
  TICKET_CATEGORY_TO_DB,
  WORKSPACE_TYPE_TO_DB,
} from "../lib/server/mappers/enums";
import { seedVenueLayouts } from "./seed-venues";

/**
 * Prisma's `InputJsonValue` requires an index signature, which the domain
 * interfaces deliberately don't have. These values are stored and read whole,
 * so the cast is safe at the boundary.
 */
function toJson(value: unknown): object | undefined {
  return value === undefined ? undefined : (value as object);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set — cannot seed.");
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/** Workspace that owns the CRM contacts, org-wide discounts and campaigns. */
const HOME_WORKSPACE_SLUG = "ava-events";

/**
 * Development accounts. Any of these phone numbers logs in once the OTP flow
 * lands; the code is printed to the server console in development.
 */
const DEV_USERS = [
  { phone: "09120000001", fullName: "مدیر آوا", owns: "ava-events" },
  { phone: "09120000002", fullName: "نگار کریمی", owns: "negar-karimi" },
  { phone: "09120000003", fullName: "سرآشپز", owns: "chef-collective" },
  { phone: "09120000004", fullName: "مدیر دوندگان", owns: "iran-runners" },
] as const;

/**
 * Empty every table.
 *
 * Derived from the database rather than listed by hand. A hand-written list
 * has to be extended with each new model and silently rots when it is not —
 * this seed broke twice that way, once when orders arrived and again when the
 * finance tables did, each time failing on a foreign key *after* having
 * already deleted half the data.
 *
 * `TRUNCATE ... CASCADE` also sidesteps ordering entirely, so there is no
 * dependency sequence left to get wrong.
 */
async function clear(): Promise<void> {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename
      FROM pg_tables
     WHERE schemaname = 'public'
       AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;

  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

async function main(): Promise<void> {
  await clear();

  // slug -> owning workspace, inverted from the fixture map.
  const slugByEvent = new Map<string, string>();
  for (const [slug, ids] of Object.entries(EVENT_WORKSPACE)) {
    for (const id of ids) slugByEvent.set(id, slug);
  }
  /** Unmapped events fall back to the home workspace, as they did before. */
  const ownerSlugOf = (eventId: string): string =>
    slugByEvent.get(eventId) ?? HOME_WORKSPACE_SLUG;

  // ── workspaces ────────────────────────────────────────────────────────
  const workspaces = workspaceFixtures;
  for (const w of workspaces) {
    await db.workspace.create({
      data: {
        id: w.id,
        slug: w.slug,
        name: w.name,
        type: WORKSPACE_TYPE_TO_DB[w.type],
        bio: w.bio,
        avatar: w.avatar,
        banner: w.banner,
        verified: w.verified ?? false,
        // Preserved so the social proof on discovery does not visibly deflate.
        seedFollowers: w.followers,
        seedFollowing: w.following,
        createdAt: new Date(w.createdAt),
      },
    });
  }
  const workspaceBySlug = new Map(workspaces.map((w) => [w.slug, w]));
  const homeWorkspace = workspaceBySlug.get(HOME_WORKSPACE_SLUG);
  if (!homeWorkspace) {
    throw new Error(`Seed workspace "${HOME_WORKSPACE_SLUG}" is missing.`);
  }

  // ── users, each owning their workspace ────────────────────────────────
  for (const u of DEV_USERS) {
    const workspace = workspaceBySlug.get(u.owns);
    if (!workspace) continue;
    await db.user.create({
      data: {
        phone: u.phone,
        fullName: u.fullName,
        memberships: { create: { workspaceId: workspace.id, role: "OWNER" } },
      },
    });
  }

  // ── venues, then events and their sessions ────────────────────────────
  for (const event of events) {
    const owner = workspaceBySlug.get(ownerSlugOf(event.id));
    if (!owner) throw new Error(`Event ${event.id} has no owning workspace.`);
    const engagement = ENGAGEMENT[event.id] ?? { going: 0, interested: 0 };

    await db.venue.create({
      data: {
        id: event.venue.id,
        name: event.venue.name,
        province: event.venue.province,
        city: event.venue.city,
        address: event.venue.address,
        capacity: event.venue.capacity,
        onlineUrl: event.venue.onlineUrl,
        lat: event.venue.lat,
        lng: event.venue.lng,
        hideAddress: event.venue.hideAddress ?? false,
      },
    });

    await db.event.create({
      data: {
        id: event.id,
        workspaceId: owner.id,
        title: event.title,
        description: event.description,
        status: EVENT_STATUS_TO_DB[event.status],
        mode: EVENT_MODE_TO_DB[event.mode],
        venueId: event.venue.id,
        recurrence: toJson(event.recurrence),
        recurrenceSchedule: toJson(event.recurrenceSchedule),
        tags: event.tags,
        categories: event.categories ?? [],
        visibility: EVENT_VISIBILITY_TO_DB[event.visibility ?? "public"],
        audienceTags: event.audienceTags ?? [],
        requiresApproval: event.requiresApproval ?? false,
        waitlist: event.waitlist ?? false,
        slug: event.slug,
        seedGoing: engagement.going,
        seedInterested: engagement.interested,
        createdAt: new Date(event.createdAt),
        updatedAt: new Date(event.updatedAt),
      },
    });

    // `@@unique([eventId, startAt])` — a fixture with two sessions at the same
    // instant would fail the insert, so surface it rather than swallowing it.
    const seen = new Set<string>();
    for (const s of event.sessions) {
      if (seen.has(s.startAt)) {
        throw new Error(
          `Event ${event.id} has duplicate sessions at ${s.startAt}.`,
        );
      }
      seen.add(s.startAt);
      await db.eventSession.create({
        data: {
          id: s.id,
          eventId: event.id,
          startAt: new Date(s.startAt),
          endAt: new Date(s.endAt),
          venueId: s.venueId,
          cancelled: s.cancelled ?? false,
          availability:
            SESSION_AVAILABILITY_TO_DB[s.availability ?? "available"],
        },
      });
    }
  }

  // ── ticket types ──────────────────────────────────────────────────────
  for (const t of ticketTypes) {
    await db.ticketType.create({
      data: {
        id: t.id,
        eventId: t.eventId,
        name: t.name,
        price: t.price,
        capacity: t.capacity,
        sold: t.sold ?? 0,
        salesStartAt: new Date(t.salesStartAt),
        salesEndAt: new Date(t.salesEndAt),
        category: TICKET_CATEGORY_TO_DB[t.category],
        description: t.description,
      },
    });
  }

  // ── CRM contacts and their tags ───────────────────────────────────────
  // The CRM is tenant-scoped, so the fixtures belong to one workspace.
  const tagIdByLabel = new Map<string, string>();
  for (const label of new Set(attendees.flatMap((a) => a.tags.map((t) => t.label)))) {
    const tag = await db.attendeeTag.create({
      data: { workspaceId: homeWorkspace.id, label },
    });
    tagIdByLabel.set(label, tag.id);
  }
  for (const a of attendees) {
    await db.attendee.create({
      data: {
        id: a.id,
        workspaceId: homeWorkspace.id,
        fullName: a.fullName,
        phone: a.phone,
        notes: a.notes,
        customFields: toJson(a.customFields) ?? [],
        createdAt: new Date(a.createdAt),
        tags: {
          create: a.tags.map((t) => ({ tagId: tagIdByLabel.get(t.label)! })),
        },
      },
    });
  }

  // ── invites ───────────────────────────────────────────────────────────
  for (const g of eventGuests) {
    await db.eventGuest.create({
      data: {
        id: g.id,
        eventId: g.eventId,
        sessionId: g.sessionId,
        contact: g.contact,
        channel: g.channel === "username" ? "USERNAME" : "PHONE",
        status: GUEST_RSVP_TO_DB[g.status],
        createdAt: new Date(g.createdAt),
      },
    });
  }
  for (const r of eventRegistrations) {
    await db.eventRegistration.create({
      data: {
        id: r.id,
        eventId: r.eventId,
        name: r.name,
        phone: r.phone,
        tickets: r.tickets,
        status: REGISTRATION_STATUS_TO_DB[r.status],
        createdAt: new Date(r.createdAt),
      },
    });
  }
  for (const c of eventCollaborators) {
    await db.eventCollaborator.create({
      data: {
        id: c.id,
        eventId: c.eventId,
        channel: COLLABORATOR_CHANNEL_TO_DB[c.channel],
        label: c.label,
        sub: c.sub,
        workspaceSlug: c.workspaceSlug,
        avatar: c.avatar,
        role: COLLAB_ROLE_TO_DB[c.role],
        status: COLLABORATOR_STATUS_TO_DB[c.status],
        // Resolved so an accepted invite actually grants access.
        inviteeWorkspaceId: c.workspaceSlug
          ? workspaceBySlug.get(c.workspaceSlug)?.id
          : undefined,
        createdAt: new Date(c.createdAt),
      },
    });
  }

  // ── discounts and campaigns ───────────────────────────────────────────
  const eventWorkspaceId = new Map<string, string>();
  for (const event of events) {
    const owner = workspaceBySlug.get(ownerSlugOf(event.id));
    if (owner) eventWorkspaceId.set(event.id, owner.id);
  }
  for (const d of discountFixtures) {
    await db.discountCode.create({
      data: {
        id: d.id,
        // An event-scoped code belongs to that event's workspace; an org-wide
        // code belongs to the home workspace.
        workspaceId:
          (d.eventId ? eventWorkspaceId.get(d.eventId) : undefined) ??
          homeWorkspace.id,
        eventId: d.eventId,
        sessionId: d.sessionId,
        code: d.code,
        kind: DISCOUNT_KIND_TO_DB[d.kind],
        value: d.value,
        maxRedemptions: d.maxRedemptions,
        redemptions: d.redemptions,
        expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
        active: d.active,
        createdAt: new Date(d.createdAt),
      },
    });
  }
  for (const c of campaignFixtures) {
    await db.campaign.create({
      data: {
        id: c.id,
        workspaceId: homeWorkspace.id,
        name: c.name,
        channel: c.channel,
        segment: c.segment,
        status: c.status,
        recipients: c.recipients,
        message: c.message,
        sentAt: c.sentAt ? new Date(c.sentAt) : null,
      },
    });
  }

  await seedVenueLayouts(db);

  const counts = {
    users: await db.user.count(),
    workspaces: await db.workspace.count(),
    members: await db.workspaceMember.count(),
    venues: await db.venue.count(),
    events: await db.event.count(),
    sessions: await db.eventSession.count(),
    ticketTypes: await db.ticketType.count(),
    attendees: await db.attendee.count(),
    attendeeTags: await db.attendeeTag.count(),
    guests: await db.eventGuest.count(),
    registrations: await db.eventRegistration.count(),
    collaborators: await db.eventCollaborator.count(),
    discounts: await db.discountCode.count(),
    campaigns: await db.campaign.count(),
    venueSections: await db.venueSection.count(),
    venueSeats: await db.venueSeat.count(),
  };
  console.table(counts);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
