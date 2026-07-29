import type { IsoDateTime } from "./api";

/** A workspace is an organizer's page: personal or a business. */
export type WorkspaceType = "personal" | "business";

/**
 * A member's standing in a workspace. There is deliberately no global role on
 * a user — holding any membership at all is what makes someone an event
 * manager, so becoming an organizer is a single insert.
 *
 * - `owner`: everything, plus workspace settings, deletion, and withdrawals.
 * - `admin`: day-to-day running of events, tickets, CRM and campaigns.
 * - `staff`: door staff — read the events they work and check people in.
 */
export type WorkspaceRole = "owner" | "admin" | "staff";

/**
 * A workspace (LinkedIn-style page). Users have a personal workspace and may
 * create business workspaces; events are owned by a workspace, and workspaces
 * have a follower graph.
 */
export interface Workspace {
  id: string;
  /** URL slug, e.g. `ava-events` -> `/w/ava-events`. */
  slug: string;
  name: string;
  type: WorkspaceType;
  bio?: string;
  /** 1-2 character avatar initials. */
  avatar: string;
  /** Optional banner/cover image URL; a seeded gradient is shown when absent. */
  banner?: string;
  followers: number;
  following: number;
  verified?: boolean;
  createdAt: IsoDateTime;
}
