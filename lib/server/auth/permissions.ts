/**
 * The authorization grant table.
 *
 * Deliberately pure — no datastore, no session, no request. Guards fetch the
 * caller's relationship to a workspace or event and hand it here; this module
 * decides. That keeps the whole permission matrix unit-testable, which matters
 * because the failure mode of an authorization bug is silent over-permission:
 * nothing errors, the wrong person simply succeeds.
 *
 * Two independent sources can grant access to an event — a membership in the
 * owning workspace, and an accepted collaborator invite. A caller gets the
 * union of whatever applies.
 */

import type { EventCollabRole, WorkspaceRole } from "@/types";

/** Something a caller may do to a single event. */
export type EventPermission =
  /** Read the event even when it is a draft or not publicly visible. */
  | "event:read"
  | "event:edit"
  /** Move the event between draft and published. */
  | "event:publish"
  | "event:delete"
  | "tickets:manage"
  | "discounts:manage"
  | "guests:manage"
  | "registrations:read"
  | "registrations:decide"
  | "collaborators:manage"
  | "checkin:perform"
  | "attendees:read";

/** Something a caller may do to a workspace as a whole. */
export type WorkspacePermission =
  | "workspace:read"
  | "workspace:edit"
  | "workspace:delete"
  | "event:create"
  | "attendees:read"
  | "attendees:write"
  | "campaigns:send"
  | "finance:read"
  /** Move money out. Owner-only, and never granted through an event. */
  | "finance:withdraw";

const ALL_EVENT_PERMISSIONS: readonly EventPermission[] = [
  "event:read",
  "event:edit",
  "event:publish",
  "event:delete",
  "tickets:manage",
  "discounts:manage",
  "guests:manage",
  "registrations:read",
  "registrations:decide",
  "collaborators:manage",
  "checkin:perform",
  "attendees:read",
];

/** Where a granted permission came from, strongest first. */
export type GrantSource =
  | "owner"
  | "admin"
  | "collaborator"
  | "staff"
  | "public";

/** Event-scoped grants by workspace role. */
const EVENT_GRANTS_BY_WORKSPACE_ROLE: Record<
  WorkspaceRole,
  readonly EventPermission[]
> = {
  owner: ALL_EVENT_PERMISSIONS,
  // An admin runs the event but cannot destroy it.
  admin: ALL_EVENT_PERMISSIONS.filter((p) => p !== "event:delete"),
  // Door staff: enough to work the entrance, nothing else.
  staff: ["event:read", "checkin:perform", "attendees:read"],
};

/** Event-scoped grants by accepted-collaborator role. */
const EVENT_GRANTS_BY_COLLAB_ROLE: Record<
  EventCollabRole,
  readonly EventPermission[]
> = {
  // A co-host runs the event, but cannot publish it, delete it, or invite
  // further collaborators — that last one would let a co-host launder their
  // own privileges into new ones.
  "co-host": [
    "event:read",
    "event:edit",
    "tickets:manage",
    "discounts:manage",
    "guests:manage",
    "registrations:read",
    "registrations:decide",
    "checkin:perform",
    "attendees:read",
  ],
  checkin: ["event:read", "checkin:perform"],
};

/** Workspace-scoped grants by role. */
const WORKSPACE_GRANTS_BY_ROLE: Record<
  WorkspaceRole,
  readonly WorkspacePermission[]
> = {
  owner: [
    "workspace:read",
    "workspace:edit",
    "workspace:delete",
    "event:create",
    "attendees:read",
    "attendees:write",
    "campaigns:send",
    "finance:read",
    "finance:withdraw",
  ],
  // An admin can spend the organiser's SMS balance but cannot move money out,
  // rename the workspace, or delete it.
  admin: [
    "workspace:read",
    "event:create",
    "attendees:read",
    "attendees:write",
    "campaigns:send",
    "finance:read",
  ],
  staff: ["workspace:read", "attendees:read"],
};

/** The caller's relationship to one event, as resolved by the guard. */
export interface EventAccessInput {
  /** Role in the workspace that owns the event, or `null` if not a member. */
  membershipRole: WorkspaceRole | null;
  /**
   * Role from an **accepted** collaborator invite whose invitee resolved to
   * this caller. Pending or revoked invites must be passed as `null` — they
   * grant nothing.
   */
  collaboratorRole: EventCollabRole | null;
  /**
   * Whether the event is readable by anyone right now, i.e. it is published
   * and its visibility is `public` or `link`.
   */
  publiclyVisible: boolean;
}

export interface EventGrant {
  permissions: ReadonlySet<EventPermission>;
  /** The strongest source that contributed, or `null` when nothing applies. */
  source: GrantSource | null;
}

/**
 * Resolve everything a caller may do to an event.
 *
 * Sources are additive: a workspace admin who is also a check-in collaborator
 * keeps the admin grants. `source` reports the strongest contributor, for
 * logging and for UI that adapts to the viewer.
 */
export function resolveEventPermissions(input: EventAccessInput): EventGrant {
  const permissions = new Set<EventPermission>();
  let source: GrantSource | null = null;

  // Weakest first, so the strongest source ends up recorded.
  if (input.publiclyVisible) {
    permissions.add("event:read");
    source = "public";
  }
  if (input.collaboratorRole) {
    for (const p of EVENT_GRANTS_BY_COLLAB_ROLE[input.collaboratorRole]) {
      permissions.add(p);
    }
    source = "collaborator";
  }
  if (input.membershipRole) {
    for (const p of EVENT_GRANTS_BY_WORKSPACE_ROLE[input.membershipRole]) {
      permissions.add(p);
    }
    source =
      input.membershipRole === "staff" && source === "collaborator"
        ? "collaborator"
        : input.membershipRole;
  }

  return { permissions, source };
}

/** Whether a caller may perform `permission` on the event. */
export function canOnEvent(
  input: EventAccessInput,
  permission: EventPermission,
): boolean {
  return resolveEventPermissions(input).permissions.has(permission);
}

/** Everything a caller may do to a workspace. Non-members get nothing. */
export function resolveWorkspacePermissions(
  role: WorkspaceRole | null,
): ReadonlySet<WorkspacePermission> {
  return new Set(role ? WORKSPACE_GRANTS_BY_ROLE[role] : []);
}

/** Whether a caller may perform `permission` on the workspace. */
export function canOnWorkspace(
  role: WorkspaceRole | null,
  permission: WorkspacePermission,
): boolean {
  return resolveWorkspacePermissions(role).has(permission);
}

export const __testing = {
  ALL_EVENT_PERMISSIONS,
  EVENT_GRANTS_BY_WORKSPACE_ROLE,
  EVENT_GRANTS_BY_COLLAB_ROLE,
  WORKSPACE_GRANTS_BY_ROLE,
};
