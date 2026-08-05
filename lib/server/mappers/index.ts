/**
 * Database rows → domain objects.
 *
 * The single place `DateTime` becomes an ISO string and Prisma's enum members
 * become the hyphenated unions in `types/`. Keeping the conversion here is
 * what lets `types/` — and therefore the wire contract — stay unchanged while
 * the storage underneath moves.
 *
 * Optional domain fields are omitted rather than set to `null`, matching what
 * the in-memory fixtures produced, so JSON responses keep their existing shape.
 */

import type {
  Attendee,
  Campaign,
  DiscountCode,
  Event,
  EventCollaborator,
  EventGuest,
  EventRegistration,
  EventSession,
  RecurrenceRule,
  RecurrenceSchedule,
  TicketType,
  Venue,
  Workspace,
  TicketDesign,
} from "@/types";
import type * as Row from "@/generated/client";

import {
  COLLABORATOR_CHANNEL_FROM_DB,
  COLLABORATOR_STATUS_FROM_DB,
  COLLAB_ROLE_FROM_DB,
  DISCOUNT_KIND_FROM_DB,
  EVENT_MODE_FROM_DB,
  EVENT_STATUS_FROM_DB,
  EVENT_VISIBILITY_FROM_DB,
  GUEST_RSVP_FROM_DB,
  REGISTRATION_STATUS_FROM_DB,
  SESSION_AVAILABILITY_FROM_DB,
  TICKET_CATEGORY_FROM_DB,
  WORKSPACE_TYPE_FROM_DB,
} from "./enums";

/** `null` → absent, so optional fields stay optional in the JSON. */
function opt<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

const iso = (d: Date): string => d.toISOString();

/**
 * A venue for the wire.
 *
 * `hideAddress` **withholds** the address here rather than leaving it to the
 * page to not render. It used to travel in full: with the flag set,
 * `GET /api/events/:id` still answered «خیابان حافظ، تالار وحدت» to any
 * unauthenticated caller, and it sat in the SSR payload of the public event
 * page. The event page hid it visually, which is not the same thing at all —
 * an organiser hiding a venue is usually doing it for a private address or a
 * safety-sensitive event, and "hidden" that survives `curl` is not hidden.
 *
 * The city and province stay: they are what makes the event findable, and an
 * organiser hiding a street number is not hiding which city they are in. The
 * coordinates go with the address, because a precise pin *is* the address.
 *
 * `reveal` is for the organiser's own edit form, which has to show what it is
 * editing. Default false, so a new caller is private by accident rather than
 * public by accident.
 */
export function toVenue(
  row: Row.Venue,
  { reveal = false }: { reveal?: boolean } = {},
): Venue {
  const hidden = row.hideAddress && !reveal;
  return {
    id: row.id,
    name: row.name,
    province: opt(row.province),
    city: row.city,
    address: hidden ? "" : row.address,
    capacity: row.capacity,
    onlineUrl: opt(row.onlineUrl),
    lat: hidden ? undefined : opt(row.lat),
    lng: hidden ? undefined : opt(row.lng),
    ...(row.hideAddress ? { hideAddress: true } : {}),
  };
}

export function toSession(row: Row.EventSession): EventSession {
  return {
    id: row.id,
    eventId: row.eventId,
    startAt: iso(row.startAt),
    endAt: iso(row.endAt),
    venueId: opt(row.venueId),
    ...(row.cancelled ? { cancelled: true } : {}),
    availability: SESSION_AVAILABILITY_FROM_DB[row.availability],
    layoutVersionId: opt(row.layoutVersionId),
  };
}

/** An event row with the relations {@link toEvent} needs. */
export type EventRow = Row.Event & {
  venue: Row.Venue;
  sessions: Row.EventSession[];
};

/**
 * `reveal` carries through to the venue: an organiser's own dashboard has to
 * show the address it is about to let them edit, while every public path keeps
 * a hidden address hidden. Default false — a new caller should be private by
 * accident, not public by accident.
 */
export function toEvent(
  row: EventRow,
  { reveal = false }: { reveal?: boolean } = {},
): Event {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    title: row.title,
    description: row.description,
    status: EVENT_STATUS_FROM_DB[row.status],
    mode: EVENT_MODE_FROM_DB[row.mode],
    venue: toVenue(row.venue, { reveal }),
    sessions: row.sessions.map(toSession),
    recurrence: opt(row.recurrence as RecurrenceRule | null),
    recurrenceSchedule: opt(
      row.recurrenceSchedule as RecurrenceSchedule | null,
    ),
    tags: row.tags,
    categories: row.categories,
    visibility: EVENT_VISIBILITY_FROM_DB[row.visibility],
    audienceTags: row.audienceTags,
    requiresApproval: row.requiresApproval,
    waitlist: row.waitlist,
    slug: opt(row.slug),
    // JSONB comes back as Prisma's JsonValue; the column only ever holds what
    // the zod schema let in, so this asserts rather than re-parsing per read.
    poster: opt(row.poster),
    ticketDesign: (row.ticketDesign as TicketDesign | null) ?? undefined,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function toTicketType(row: Row.TicketType): TicketType {
  return {
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    price: row.price,
    capacity: row.capacity,
    sold: row.sold,
    salesStartAt: iso(row.salesStartAt),
    salesEndAt: iso(row.salesEndAt),
    category: TICKET_CATEGORY_FROM_DB[row.category],
    description: opt(row.description),
  };
}

export function toWorkspace(row: Row.Workspace): Workspace {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: WORKSPACE_TYPE_FROM_DB[row.type],
    bio: opt(row.bio),
    avatar: row.avatar,
    banner: opt(row.banner),
    // Seeded baseline plus, later, the real Follow rows.
    followers: row.seedFollowers,
    following: row.seedFollowing,
    ...(row.verified ? { verified: true } : {}),
    createdAt: iso(row.createdAt),
  };
}

/** An attendee row with its tag links resolved. */
export type AttendeeRow = Row.Attendee & {
  tags: (Row.AttendeeTagLink & { tag: Row.AttendeeTag })[];
};

export function toAttendee(row: AttendeeRow): Attendee {
  return {
    id: row.id,
    fullName: row.fullName,
    phone: row.phone,
    tags: row.tags.map((link) => ({
      id: link.tag.id,
      label: link.tag.label,
      color: opt(link.tag.color),
    })),
    notes: opt(row.notes),
    customFields: (row.customFields ?? []) as unknown as Attendee["customFields"],
    createdAt: iso(row.createdAt),
  };
}

export function toGuest(row: Row.EventGuest): EventGuest {
  return {
    id: row.id,
    eventId: row.eventId,
    sessionId: row.sessionId,
    contact: row.contact,
    channel: row.channel === "USERNAME" ? "username" : "phone",
    status: GUEST_RSVP_FROM_DB[row.status],
    createdAt: iso(row.createdAt),
  };
}

export function toRegistration(row: Row.EventRegistration): EventRegistration {
  return {
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    phone: row.phone,
    tickets: row.tickets,
    status: REGISTRATION_STATUS_FROM_DB[row.status],
    createdAt: iso(row.createdAt),
  };
}

export function toCollaborator(row: Row.EventCollaborator): EventCollaborator {
  return {
    id: row.id,
    eventId: row.eventId,
    channel: COLLABORATOR_CHANNEL_FROM_DB[row.channel],
    label: row.label,
    sub: row.sub,
    workspaceSlug: opt(row.workspaceSlug),
    avatar: opt(row.avatar),
    role: COLLAB_ROLE_FROM_DB[row.role],
    status: COLLABORATOR_STATUS_FROM_DB[row.status],
    createdAt: iso(row.createdAt),
    acceptedAt: row.acceptedAt ? iso(row.acceptedAt) : undefined,
  };
}

export function toDiscount(row: Row.DiscountCode): DiscountCode {
  return {
    id: row.id,
    eventId: row.eventId,
    sessionId: opt(row.sessionId),
    code: row.code,
    kind: DISCOUNT_KIND_FROM_DB[row.kind],
    value: row.value,
    maxRedemptions: row.maxRedemptions,
    redemptions: row.redemptions,
    reserved: row.reserved,
    expiresAt: row.expiresAt ? iso(row.expiresAt) : null,
    active: row.active,
    createdAt: iso(row.createdAt),
  };
}

export function toCampaign(row: Row.Campaign): Campaign {
  return {
    id: row.id,
    name: row.name,
    channel: "sms",
    segment: row.segment,
    status: row.status as Campaign["status"],
    recipients: row.recipients,
    message: row.message,
    sentAt: row.sentAt ? iso(row.sentAt) : undefined,
  };
}
