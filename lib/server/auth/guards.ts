/**
 * Request-scoped authorization.
 *
 * These resolve *who is asking* and *how they relate* to a workspace or event,
 * then hand that to the pure grant table in `./permissions` to decide. Guards
 * throw {@link HttpError}; the `handler()` wrapper turns it into the envelope,
 * so no route builds a 401/403 by hand.
 */

import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/active-workspace";

import type { Event, EventCollabRole, WorkspaceRole } from "@/types";

import { db } from "../db";
import { HttpError } from "../http";
import { getEventByIdOrSlug } from "../events";
import { WORKSPACE_ROLE_FROM_DB, COLLAB_ROLE_FROM_DB } from "../mappers/enums";
import {
  resolveEventPermissions,
  resolveWorkspacePermissions,
  type EventPermission,
  type GrantSource,
  type WorkspacePermission,
} from "./permissions";
import { readSessionCookie, resolveSession, type SessionUser } from "./session";

export type { SessionUser };

export interface Membership {
  workspaceId: string;
  slug: string;
  name: string;
  role: WorkspaceRole;
}

export interface EventGrant {
  eventId: string;
  workspaceId: string;
  permissions: ReadonlySet<EventPermission>;
  source: GrantSource | null;
}

/**
 * The signed-in user, or `null`.
 *
 * `cache()`-wrapped so a page and every nested Server Component it renders
 * share one session lookup per request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = await readSessionCookie();
  return token ? resolveSession(token) : null;
});

/** @throws HttpError 401 when nobody is signed in. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new HttpError(401, "UNAUTHENTICATED", "ابتدا وارد شوید.");
  }
  return user;
}

/** Every workspace the user belongs to. Empty for a normal (non-manager) user. */
export const listMemberships = cache(
  async (userId: string): Promise<Membership[]> => {
    const rows = await db.workspaceMember.findMany({
      where: { userId },
      select: {
        role: true,
        workspace: { select: { id: true, slug: true, name: true } },
      },
    });
    return rows.map((r) => ({
      workspaceId: r.workspace.id,
      slug: r.workspace.slug,
      name: r.workspace.name,
      role: WORKSPACE_ROLE_FROM_DB[r.role],
    }));
  },
);

/**
 * Holding any workspace membership is what makes someone an event manager —
 * there is deliberately no role column on the user.
 *
 * @throws HttpError 401, or 403 `NOT_A_MANAGER`.
 */
export async function requireManager(): Promise<{
  user: SessionUser;
  memberships: Membership[];
}> {
  const user = await requireUser();
  const memberships = await listMemberships(user.id);
  if (memberships.length === 0) {
    throw new HttpError(
      403,
      "NOT_A_MANAGER",
      "برای دسترسی به داشبورد باید فضای کاری داشته باشید.",
    );
  }
  return { user, memberships };
}

/** @throws HttpError 401 / 403. */
export async function requireWorkspaceAccess(
  workspaceId: string,
  permission: WorkspacePermission,
): Promise<{ user: SessionUser; membership: Membership }> {
  const user = await requireUser();
  const membership = (await listMemberships(user.id)).find(
    (m) => m.workspaceId === workspaceId,
  );

  if (!membership || !resolveWorkspacePermissions(membership.role).has(permission)) {
    throw new HttpError(403, "FORBIDDEN", "به این بخش دسترسی ندارید.");
  }
  return { user, membership };
}

/** Whether an event is readable by anyone right now. */
function isPubliclyVisible(event: Event): boolean {
  return (
    event.status === "published" &&
    (event.visibility === "public" || event.visibility === "link")
  );
}

/**
 * Everything the current caller may do to an event — no throwing, for public
 * pages that adapt to their viewer. `null` when the event does not exist.
 */
export async function resolveEventGrant(
  eventIdOrSlug: string,
): Promise<EventGrant | null> {
  const event = await getEventByIdOrSlug(eventIdOrSlug);
  if (!event) return null;

  const user = await getCurrentUser();
  const base = {
    eventId: event.id,
    workspaceId: event.workspaceId,
  };

  if (!user) {
    const grant = resolveEventPermissions({
      membershipRole: null,
      collaboratorRole: null,
      publiclyVisible: isPubliclyVisible(event),
    });
    return { ...base, ...grant };
  }

  const memberships = await listMemberships(user.id);
  const membershipRole =
    memberships.find((m) => m.workspaceId === event.workspaceId)?.role ?? null;

  // Only accepted invites resolved to this caller — a pending invite by phone
  // grants nothing.
  const collaborator = await db.eventCollaborator.findFirst({
    where: {
      eventId: event.id,
      status: "ACCEPTED",
      OR: [
        { inviteeUserId: user.id },
        { inviteeWorkspaceId: { in: memberships.map((m) => m.workspaceId) } },
      ],
    },
    select: { role: true },
  });

  const grant = resolveEventPermissions({
    membershipRole,
    collaboratorRole: collaborator
      ? (COLLAB_ROLE_FROM_DB[collaborator.role] as EventCollabRole)
      : null,
    publiclyVisible: isPubliclyVisible(event),
  });
  return { ...base, ...grant };
}

/**
 * Assert the caller may perform `permission` on an event.
 *
 * @throws HttpError 404 when it does not exist, 401 when anonymous and the
 * event is not publicly readable, 403 otherwise.
 */
export async function requireEventAccess(
  eventIdOrSlug: string,
  permission: EventPermission,
): Promise<{ user: SessionUser | null; event: Event; grant: EventGrant }> {
  const grant = await resolveEventGrant(eventIdOrSlug);
  if (!grant) {
    throw new HttpError(404, "NOT_FOUND", `Event "${eventIdOrSlug}" was not found.`);
  }

  const event = await getEventByIdOrSlug(eventIdOrSlug);
  if (!event) {
    throw new HttpError(404, "NOT_FOUND", `Event "${eventIdOrSlug}" was not found.`);
  }

  if (!grant.permissions.has(permission)) {
    const user = await getCurrentUser();
    if (!user) {
      throw new HttpError(401, "UNAUTHENTICATED", "ابتدا وارد شوید.");
    }
    throw new HttpError(403, "FORBIDDEN", "به این رویداد دسترسی ندارید.");
  }

  return { user: await getCurrentUser(), event, grant };
}

/**
 * Page-level dashboard gate.
 *
 * Layouts and pages render **in parallel** in the App Router, so a redirect in
 * `(dashboard)/layout.tsx` unwinds the layout while the page underneath has
 * already rendered and streamed its data. The layout gate is therefore not
 * enough on its own — each dashboard page calls this before touching data.
 *
 * Redirects rather than throwing, because neither case is exceptional: a
 * signed-out visitor belongs at /login, and a signed-in user with no workspace
 * belongs on the attendee side.
 */
export async function requireManagerPage(): Promise<{
  user: SessionUser;
  memberships: Membership[];
  /** The workspace being viewed — always one the caller actually belongs to. */
  workspace: Membership;
}> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  const memberships = await listMemberships(user.id);
  if (memberships.length === 0) redirect("/me");

  // The cookie is a preference, not a credential: a value naming a workspace
  // the caller does not belong to falls back rather than granting anything.
  const store = await cookies();
  const preferred = store.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const workspace =
    memberships.find((m) => m.workspaceId === preferred) ?? memberships[0];

  return { user, memberships, workspace };
}
