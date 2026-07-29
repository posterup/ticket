/**
 * Bridge between Prisma's enum members and the TypeScript unions in `types/`.
 *
 * Prisma enum members cannot contain hyphens, so the schema uses SCREAMING_CASE
 * with `@map("one-time")` on the column value. The wire contract keeps the
 * hyphenated form, so every read and write crosses this boundary exactly once.
 *
 * Each map is declared `Record<DomainUnion, PrismaEnum>` — adding a member to
 * one side without the other is a compile error, and `tests/enums.test.ts`
 * asserts the inverses stay in step.
 */

import * as P from "@/generated/enums";
import type {
  CollaboratorChannel,
  CollaboratorStatus,
  DiscountKind,
  EventCollabRole,
  EventMode,
  EventStatus,
  EventVisibility,
  GuestRsvp,
  RegistrationStatus,
  SessionAvailability,
  TicketCategory,
  TicketStatus,
  WorkspaceRole,
  WorkspaceType,
} from "@/types";

/** Invert a domain→Prisma map into a Prisma→domain lookup. */
function invert<D extends string, Q extends string>(
  forward: Record<D, Q>,
): Record<Q, D> {
  return Object.fromEntries(
    Object.entries(forward).map(([domain, prisma]) => [prisma, domain]),
  ) as Record<Q, D>;
}

export const EVENT_STATUS_TO_DB: Record<EventStatus, P.EventStatus> = {
  draft: P.EventStatus.DRAFT,
  published: P.EventStatus.PUBLISHED,
  cancelled: P.EventStatus.CANCELLED,
  completed: P.EventStatus.COMPLETED,
};
export const EVENT_STATUS_FROM_DB = invert(EVENT_STATUS_TO_DB);

export const EVENT_VISIBILITY_TO_DB: Record<EventVisibility, P.EventVisibility> =
  {
    public: P.EventVisibility.PUBLIC,
    link: P.EventVisibility.LINK,
    audience: P.EventVisibility.AUDIENCE,
  };
export const EVENT_VISIBILITY_FROM_DB = invert(EVENT_VISIBILITY_TO_DB);

export const EVENT_MODE_TO_DB: Record<EventMode, P.EventMode> = {
  "one-time": P.EventMode.ONE_TIME,
  recurring: P.EventMode.RECURRING,
  "multi-session": P.EventMode.MULTI_SESSION,
};
export const EVENT_MODE_FROM_DB = invert(EVENT_MODE_TO_DB);

export const SESSION_AVAILABILITY_TO_DB: Record<
  SessionAvailability,
  P.SessionAvailability
> = {
  full: P.SessionAvailability.FULL,
  "almost-full": P.SessionAvailability.ALMOST_FULL,
  soon: P.SessionAvailability.SOON,
  available: P.SessionAvailability.AVAILABLE,
};
export const SESSION_AVAILABILITY_FROM_DB = invert(SESSION_AVAILABILITY_TO_DB);

export const TICKET_CATEGORY_TO_DB: Record<TicketCategory, P.TicketCategory> = {
  general: P.TicketCategory.GENERAL,
  vip: P.TicketCategory.VIP,
  student: P.TicketCategory.STUDENT,
  "early-bird": P.TicketCategory.EARLY_BIRD,
  backstage: P.TicketCategory.BACKSTAGE,
  group: P.TicketCategory.GROUP,
};
export const TICKET_CATEGORY_FROM_DB = invert(TICKET_CATEGORY_TO_DB);

export const TICKET_STATUS_TO_DB: Record<TicketStatus, P.TicketStatus> = {
  issued: P.TicketStatus.ISSUED,
  "checked-in": P.TicketStatus.CHECKED_IN,
  cancelled: P.TicketStatus.CANCELLED,
  refunded: P.TicketStatus.REFUNDED,
};
export const TICKET_STATUS_FROM_DB = invert(TICKET_STATUS_TO_DB);

export const DISCOUNT_KIND_TO_DB: Record<DiscountKind, P.DiscountKind> = {
  percent: P.DiscountKind.PERCENT,
  fixed: P.DiscountKind.FIXED,
};
export const DISCOUNT_KIND_FROM_DB = invert(DISCOUNT_KIND_TO_DB);

export const GUEST_RSVP_TO_DB: Record<GuestRsvp, P.GuestRsvp> = {
  pending: P.GuestRsvp.PENDING,
  going: P.GuestRsvp.GOING,
  declined: P.GuestRsvp.DECLINED,
};
export const GUEST_RSVP_FROM_DB = invert(GUEST_RSVP_TO_DB);

export const REGISTRATION_STATUS_TO_DB: Record<
  RegistrationStatus,
  P.RegistrationStatus
> = {
  pending: P.RegistrationStatus.PENDING,
  accepted: P.RegistrationStatus.ACCEPTED,
  rejected: P.RegistrationStatus.REJECTED,
};
export const REGISTRATION_STATUS_FROM_DB = invert(REGISTRATION_STATUS_TO_DB);

export const COLLABORATOR_CHANNEL_TO_DB: Record<
  CollaboratorChannel,
  P.CollaboratorChannel
> = {
  workspace: P.CollaboratorChannel.WORKSPACE,
  phone: P.CollaboratorChannel.PHONE,
  username: P.CollaboratorChannel.USERNAME,
};
export const COLLABORATOR_CHANNEL_FROM_DB = invert(COLLABORATOR_CHANNEL_TO_DB);

/**
 * `revoked` has no counterpart in `types/collaborator.ts` yet — it arrives with
 * the collaborator-roles work. Until then the domain side is widened here only.
 */
export const COLLABORATOR_STATUS_TO_DB: Record<
  CollaboratorStatus,
  P.CollaboratorStatus
> = {
  pending: P.CollaboratorStatus.PENDING,
  accepted: P.CollaboratorStatus.ACCEPTED,
};
export const COLLABORATOR_STATUS_FROM_DB = invert(COLLABORATOR_STATUS_TO_DB);

export const WORKSPACE_TYPE_TO_DB: Record<WorkspaceType, P.WorkspaceType> = {
  personal: P.WorkspaceType.PERSONAL,
  business: P.WorkspaceType.BUSINESS,
};
export const WORKSPACE_TYPE_FROM_DB = invert(WORKSPACE_TYPE_TO_DB);

export const WORKSPACE_ROLE_TO_DB: Record<WorkspaceRole, P.WorkspaceRole> = {
  owner: P.WorkspaceRole.OWNER,
  admin: P.WorkspaceRole.ADMIN,
  staff: P.WorkspaceRole.STAFF,
};
export const WORKSPACE_ROLE_FROM_DB = invert(WORKSPACE_ROLE_TO_DB);

export const COLLAB_ROLE_TO_DB: Record<EventCollabRole, P.EventCollabRole> = {
  "co-host": P.EventCollabRole.CO_HOST,
  checkin: P.EventCollabRole.CHECKIN,
};
export const COLLAB_ROLE_FROM_DB = invert(COLLAB_ROLE_TO_DB);
