/**
 * Attendee (CRM contact) data-access over Postgres.
 *
 * Contacts are tenant-scoped: each belongs to one workspace, and so do the
 * tags applied to them.
 */

import type { Attendee, Event } from "@/types";

import { db } from "./db";
import { toAttendee, toEvent, type AttendeeRow, type EventRow } from "./mappers";

// Ordered, so a contact's tags do not shuffle between reads — the previous
// shape returned them in whatever order the join produced.
const TAG_INCLUDE = {
  tags: { include: { tag: true }, orderBy: { tag: { label: "asc" } } },
} as const;

/** A workspace's CRM contacts, newest first. */
export async function listAttendees(workspaceId: string): Promise<Attendee[]> {
  const rows = await db.attendee.findMany({
    where: { workspaceId },
    include: TAG_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => toAttendee(row as AttendeeRow));
}

/** Look up a single contact by id. */
export async function getAttendeeById(
  id: string,
): Promise<Attendee | undefined> {
  const row = await db.attendee.findUnique({
    where: { id },
    include: TAG_INCLUDE,
  });
  return row ? toAttendee(row as AttendeeRow) : undefined;
}

/** A workspace's tag labels with how many contacts carry each, most-used first. */
export async function listAttendeeTags(
  workspaceId: string,
): Promise<{ label: string; count: number }[]> {
  const tags = await db.attendeeTag.findMany({
    where: { workspaceId },
    select: { label: true, _count: { select: { links: true } } },
  });
  return tags
    .map((t) => ({ label: t.label, count: t._count.links }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * Replace a contact's tags (from string labels); returns it, or `undefined`.
 *
 * Labels that do not exist yet are created in the contact's own workspace, so
 * the CRM vocabulary stays per-tenant.
 */
export async function setAttendeeTags(
  id: string,
  labels: string[],
): Promise<Attendee | undefined> {
  const attendee = await db.attendee.findUnique({
    where: { id },
    select: { id: true, workspaceId: true },
  });
  if (!attendee) return undefined;

  const wanted = [...new Set(labels)];
  const tagIds = await Promise.all(
    wanted.map(async (label) => {
      const tag = await db.attendeeTag.upsert({
        where: {
          workspaceId_label: { workspaceId: attendee.workspaceId, label },
        },
        create: { workspaceId: attendee.workspaceId, label },
        update: {},
        select: { id: true },
      });
      return tag.id;
    }),
  );

  await db.$transaction([
    db.attendeeTagLink.deleteMany({ where: { attendeeId: id } }),
    db.attendeeTagLink.createMany({
      data: tagIds.map((tagId) => ({ attendeeId: id, tagId })),
    }),
  ]);

  return getAttendeeById(id);
}

/**
 * Events a contact has joined.
 *
 * Derived from their paid orders. Until checkout writes orders this is empty,
 * where it used to be a hardcoded map — the CRM history becomes real rather
 * than illustrative.
 */
export async function listEventsByAttendee(id: string): Promise<Event[]> {
  const rows = await db.event.findMany({
    where: { orders: { some: { attendeeId: id, status: "PAID" } } },
    include: { venue: true, sessions: { orderBy: { startAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => toEvent(row as EventRow));
}
