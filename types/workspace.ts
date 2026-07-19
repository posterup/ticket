import type { IsoDateTime } from "./api";

/** A workspace is an organizer's page: personal or a business. */
export type WorkspaceType = "personal" | "business";

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
  followers: number;
  following: number;
  verified?: boolean;
  createdAt: IsoDateTime;
}
