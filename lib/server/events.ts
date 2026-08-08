/**
 * Event data-access over Postgres.
 *
 * Reads always include the venue and sessions, because `Event` in `types/`
 * carries them inline — the wire shape is unchanged from the in-memory era.
 */

import type {
  CreateEventInput,
  Event,
  EventSession,
  RecurrenceSchedule,
  SessionAvailability,
  Venue,
} from "@/types";
import {
  expandSchedule,
  sessionInstants,
  slotFromStored,
  type ScheduleDraft,
} from "@/lib/create/types";
import { phoneVariants } from "@/lib/server/sms";
import { CALENDAR_MODE_ENABLED } from "@/lib/flags";

import type { Prisma } from "@/generated/client";
import { db } from "./db";
import {
  notifyEventCancelled,
  notifySessionCancelled,
} from "./notifications/show-cancelled";
import { notifyEventPublished } from "./notifications/waiting";
import { toEvent, toSession, toVenue, type EventRow } from "./mappers";
import {
  EVENT_MODE_TO_DB,
  EVENT_STATUS_TO_DB,
  EVENT_VISIBILITY_TO_DB,
  SESSION_AVAILABILITY_TO_DB,
} from "./mappers/enums";

/** Everything {@link toEvent} needs, with sessions in chronological order. */
const INCLUDE = {
  venue: true,
  sessions: { orderBy: { startAt: "asc" } },
} as const;

/**
 * Return every event, newest first. While calendar mode is disabled, recurring
 * (تقویمی) events are hidden from every listing so the mode leaves no trace;
 * direct lookups ({@link getEventById}) still resolve them.
 */
export async function listEvents(): Promise<Event[]> {
  const rows = await db.event.findMany({
    where: CALENDAR_MODE_ENABLED ? undefined : { mode: { not: "RECURRING" } },
    include: INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => toEvent(row as EventRow));
}

/**
 * Events a visitor may see in discovery.
 *
 * Public events for everyone. When a signed-in viewer is supplied, events
 * targeted at a CRM segment they belong to are folded in as well — otherwise
 * targeting only works for someone who was already sent a link, which is not
 * targeting at all.
 *
 * `link`-only events stay out by design: the whole point of that setting is
 * that the URL is the key.
 *
 * {@link listEvents} includes drafts and is for callers that have already
 * proven access.
 */
export async function listPublicEvents(viewer?: {
  id: string;
  phone: string;
}): Promise<Event[]> {
  const notRecurring = CALENDAR_MODE_ENABLED
    ? {}
    : { mode: { not: "RECURRING" as const } };

  // Which segments this viewer belongs to, per workspace. One query rather
  // than a correlated check per event.
  const memberOf = viewer
    ? await db.attendee.findMany({
        // Not `phone: viewer.phone`. Attendee rows keep whatever format they
        // were created with, so an exact match hid targeted events from the
        // very people they were aimed at.
        where: { phone: { in: phoneVariants(viewer.phone) } },
        select: {
          workspaceId: true,
          tags: { select: { tag: { select: { label: true } } } },
        },
      })
    : [];

  const targeted = memberOf
    .map((a) => ({
      workspaceId: a.workspaceId,
      labels: a.tags.map((t) => t.tag.label),
    }))
    .filter((a) => a.labels.length > 0);

  const rows = await db.event.findMany({
    where: {
      status: "PUBLISHED",
      ...notRecurring,
      OR: [
        { visibility: "PUBLIC" },
        ...targeted.map((a) => ({
          visibility: "AUDIENCE" as const,
          workspaceId: a.workspaceId,
          audienceTags: { hasSome: a.labels },
        })),
      ],
    },
    include: INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => toEvent(row as EventRow));
}

/**
 * Every event a workspace owns, newest first — including drafts.
 *
 * What the dashboard lists. `listEvents()` is deliberately not used there: it
 * returns every event in the system, which on a dashboard is another
 * workspace's data.
 */
export async function listEventsByWorkspaceId(
  workspaceId: string,
): Promise<Event[]> {
  const rows = await db.event.findMany({
    where: { workspaceId },
    include: INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => toEvent(row as EventRow));
}

/** Return a single event by id, or `undefined` when not found. */
export async function getEventById(
  id: string,
  options: { reveal?: boolean } = {},
): Promise<Event | undefined> {
  const row = await db.event.findUnique({ where: { id }, include: INCLUDE });
  return row ? toEvent(row as EventRow, options) : undefined;
}

/** Return a single event by its custom slug, or `undefined`. */
export async function getEventBySlug(slug: string): Promise<Event | undefined> {
  const row = await db.event.findUnique({ where: { slug }, include: INCLUDE });
  return row ? toEvent(row as EventRow) : undefined;
}

/** Resolve an event by id first, then by custom slug (public routes). */
export async function getEventByIdOrSlug(
  idOrSlug: string,
): Promise<Event | undefined> {
  return (await getEventById(idOrSlug)) ?? (await getEventBySlug(idOrSlug));
}

/**
 * The workspace a new event belongs to.
 *
 * Ownership comes from the session once auth lands. Until then a caller may
 * name a workspace explicitly, and anything else falls back to the first —
 * mirroring what `getWorkspaceByEvent` did for unmapped events before.
 */
async function resolveWorkspaceId(preferred?: string): Promise<string> {
  if (preferred) {
    const found = await db.workspace.findUnique({
      where: { id: preferred },
      select: { id: true },
    });
    if (found) return found.id;
  }
  const first = await db.workspace.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!first) {
    throw new Error("No workspace exists to own the event — seed the database.");
  }
  return first.id;
}

/** Create and persist a new event, returning the stored record. */
export async function createEvent(
  input: CreateEventInput & { workspaceId?: string },
): Promise<Event> {
  const workspaceId = await resolveWorkspaceId(input.workspaceId);

  // The venue is created first: passing a scalar `workspaceId` alongside a
  // nested `venue.create` would put Prisma in its unchecked-input mode, which
  // does not accept nested writes.
  const venue = await db.venue.create({ data: { ...input.venue } });

  const row = await db.event.create({
    data: {
      workspaceId,
      venueId: venue.id,
      title: input.title,
      description: input.description,
      status: EVENT_STATUS_TO_DB[input.status ?? "draft"],
      mode: EVENT_MODE_TO_DB[input.mode],
      recurrence: input.recurrence ? (input.recurrence as object) : undefined,
      tags: input.tags ?? [],
      visibility: EVENT_VISIBILITY_TO_DB[input.visibility ?? "public"],
      audienceTags: input.audienceTags ?? [],
      requiresApproval: input.requiresApproval ?? false,
      poster: input.poster ?? null,
      sessions: {
        create: input.sessions.map((s) => ({
          startAt: new Date(s.startAt),
          endAt: new Date(s.endAt),
          ...(s.availability
            ? { availability: SESSION_AVAILABILITY_TO_DB[s.availability] }
            : {}),
        })),
      },
    },
    include: INCLUDE,
  });
  return toEvent(row as EventRow);
}

/** Fields an organizer may edit on an existing event. */
export type EventUpdate = Partial<
  Pick<
    Event,
    | "title"
    | "description"
    | "status"
    | "visibility"
    | "audienceTags"
    | "requiresApproval"
    | "slug"
    | "recurrenceSchedule"
    | "ticketDesign"
  >
> & {
  /**
   * `null` clears the cover; `undefined` leaves it alone.
   *
   * `Pick<Event, "poster">` cannot say this — the domain type has `poster?:
   * string`, because an event either has a cover or does not, and "explicitly
   * remove it" is a thing only an *update* can mean.
   */
  poster?: string | null;
};

/** ScheduleDraft equivalent of a stored {@link RecurrenceSchedule}. */
function toScheduleDraft(spec: RecurrenceSchedule): ScheduleDraft {
  const toSlot = slotFromStored;
  return {
    calendar: true,
    startDate: spec.startDate,
    endDate: spec.endDate,
    byDay: spec.byDay,
    slots: spec.slots.map(toSlot),
    daySlots: Object.fromEntries(
      Object.entries(spec.daySlots ?? {}).map(([d, arr]) => [
        d,
        (arr ?? []).map(toSlot),
      ]),
    ),
    exceptions: spec.exceptions,
  };
}

/**
 * Regenerate an event's sessions from a calendar schedule.
 *
 * Sessions are matched on start time rather than id — that is what the
 * `@@unique([eventId, startAt])` index exists for — so a surviving سانس keeps
 * its row, and with it its availability, cancelled flag and any references.
 */
async function applySchedule(
  eventId: string,
  spec: RecurrenceSchedule,
): Promise<void> {
  const existing = await db.eventSession.findMany({ where: { eventId } });
  const byStart = new Map(existing.map((s) => [s.startAt.toISOString(), s]));

  // `sessionInstants` — the same conversion the wizard submits through, and
  // venue wall-clock rather than a `Z`. Appending `Z` here put every
  // regenerated سانس three and a half hours late, and because the match below
  // keys on `startAt`, none of them lined up with the rows the wizard had
  // written: the transaction deleted every existing سانس and made new ones,
  // discarding availability, the cancelled flag, and any order pointing at
  // them. Sharing the helper is what keeps the two paths from drifting apart
  // again.
  const wanted = expandSchedule(toScheduleDraft(spec)).map((s) => {
    const { startAt, endAt } = sessionInstants(s);
    return { startAt: new Date(startAt), endAt: new Date(endAt) };
  });
  const wantedKeys = new Set(wanted.map((s) => s.startAt.toISOString()));

  await db.$transaction([
    // Drop the سانس‌ها the new schedule no longer contains.
    db.eventSession.deleteMany({
      where: {
        eventId,
        id: {
          in: existing
            .filter((s) => !wantedKeys.has(s.startAt.toISOString()))
            .map((s) => s.id),
        },
      },
    }),
    // Add the ones it gained; survivors are left untouched.
    ...wanted
      .filter((s) => !byStart.has(s.startAt.toISOString()))
      .map((s) =>
        db.eventSession.create({
          data: { eventId, startAt: s.startAt, endAt: s.endAt },
        }),
      ),
  ]);
}

/** Apply an update to an event; returns it, or `undefined` if absent. */
export async function updateEvent(
  id: string,
  patch: EventUpdate,
): Promise<Event | undefined> {
  const exists = await db.event.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return undefined;

  const before = await db.event.findUnique({
    where: { id },
    select: { status: true },
  });
  const newlyCancelled =
    patch.status === "cancelled" && before?.status !== "CANCELLED";
  // «خبرم کن» subscribers are waiting for exactly this moment. Only the
  // transition counts: re-saving a published event must not message them again.
  const newlyPublished =
    patch.status === "published" && before?.status !== "PUBLISHED";

  if (patch.recurrenceSchedule !== undefined) {
    await applySchedule(id, patch.recurrenceSchedule);
  }

  await db.event.update({
    where: { id },
    data: {
      title: patch.title,
      description: patch.description,
      status: patch.status ? EVENT_STATUS_TO_DB[patch.status] : undefined,
      visibility: patch.visibility
        ? EVENT_VISIBILITY_TO_DB[patch.visibility]
        : undefined,
      audienceTags: patch.audienceTags,
      requiresApproval: patch.requiresApproval,
      poster: patch.poster,
      slug: patch.slug,
      // Replaced whole, never merged: the designer always sends the complete
      // template, and a partial merge would make "clear the logo" impossible
      // to express. Cast because Prisma's InputJsonValue does not accept an
      // interface with optional properties, only an index-signature object —
      // the value is zod-validated at the route before it reaches here.
      ticketDesign: patch.ticketDesign as Prisma.InputJsonValue | undefined,
      ...(patch.recurrenceSchedule !== undefined
        ? {
            recurrenceSchedule: patch.recurrenceSchedule as object,
            recurrence: {
              frequency: "weekly",
              interval: 1,
              ...(patch.recurrenceSchedule.byDay.length > 0
                ? { byDay: patch.recurrenceSchedule.byDay }
                : {}),
            } as object,
          }
        : {}),
    },
  });

  if (newlyCancelled) void notifyEventCancelled(id);
  if (newlyPublished) void notifyEventPublished(id);

  return getEventById(id);
}

/** Append a new سانس (session) to an event; returns it, or `undefined`. */
export async function addSession(
  eventId: string,
  input: { startAt: string; endAt: string; availability?: SessionAvailability },
): Promise<EventSession | undefined> {
  const exists = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!exists) return undefined;

  const row = await db.eventSession.create({
    data: {
      eventId,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      ...(input.availability
        ? { availability: SESSION_AVAILABILITY_TO_DB[input.availability] }
        : {}),
    },
  });
  await db.event.update({ where: { id: eventId }, data: { updatedAt: new Date() } });
  return toSession(row);
}

/** Venue fields an organizer may edit from the dashboard. */
export type VenueUpdate = Partial<
  Pick<
    Venue,
    "name" | "province" | "city" | "address" | "capacity" | "lat" | "lng" | "hideAddress"
  >
>;

/** Update an event's venue; returns it, or `undefined` if absent. */
export async function updateVenue(
  eventId: string,
  patch: VenueUpdate,
): Promise<Venue | undefined> {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { venueId: true },
  });
  if (!event) return undefined;

  const row = await db.venue.update({ where: { id: event.venueId }, data: patch });
  await db.event.update({ where: { id: eventId }, data: { updatedAt: new Date() } });
  // The organiser is editing it; they may see what they are editing.
  return toVenue(row, { reveal: true });
}

/** Fields an organizer may edit on a single سانس (session). */
export type SessionUpdate = Partial<
  Pick<EventSession, "startAt" | "endAt" | "cancelled" | "availability">
>;

/**
 * Update one session of an event (reschedule or cancel/restore).
 * Returns the session, or `undefined` when the event/session is not found.
 */
export async function updateSession(
  eventId: string,
  sessionId: string,
  patch: SessionUpdate,
): Promise<EventSession | undefined> {
  const session = await db.eventSession.findUnique({ where: { id: sessionId } });
  if (!session || session.eventId !== eventId) return undefined;

  // Captured before the write: only a *transition* into cancelled may notify.
  // Re-saving an already-cancelled سانس is what a form does on every submit,
  // and it must not text everyone a second time.
  const newlyCancelled = patch.cancelled === true && !session.cancelled;

  const row = await db.eventSession.update({
    where: { id: sessionId },
    data: {
      startAt: patch.startAt ? new Date(patch.startAt) : undefined,
      endAt: patch.endAt ? new Date(patch.endAt) : undefined,
      cancelled: patch.cancelled,
      availability: patch.availability
        ? SESSION_AVAILABILITY_TO_DB[patch.availability]
        : undefined,
    },
  });
  await db.event.update({ where: { id: eventId }, data: { updatedAt: new Date() } });

  // Not awaited: an organiser cancelling a show should not sit watching a
  // spinner while a thousand messages go out, and the notifier never throws.
  if (newlyCancelled) void notifySessionCancelled(eventId, sessionId);

  return toSession(row);
}

export type DeleteOutcome =
  | { ok: true }
  | { ok: false; reason: "not-found" | "has-sales"; message: string };

/**
 * Delete an event.
 *
 * Refused once anything has been sold: an event with paid orders is the only
 * record of what those buyers hold, and cascading it away would take their
 * tickets with it. Cancelling is the right move there, which is why
 * `EventStatus` has a `cancelled` member.
 */
export async function deleteEvent(id: string): Promise<DeleteOutcome> {
  const event = await db.event.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!event) {
    return { ok: false, reason: "not-found", message: "رویداد یافت نشد." };
  }

  const sold = await db.order.count({
    where: { eventId: id, status: { in: ["PAID", "REFUNDED"] } },
  });
  if (sold > 0) {
    return {
      ok: false,
      reason: "has-sales",
      message: "رویدادی که بلیت فروخته است حذف نمی‌شود؛ آن را لغو کنید.",
    };
  }

  await db.event.delete({ where: { id } });
  return { ok: true };
}
