"use client";

import { createContext, useContext, useMemo, useState } from "react";

import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/active-workspace";
import type { Workspace } from "@/types";

interface ActiveWorkspaceValue {
  workspaces: Workspace[];
  active: Workspace | null;
  select: (id: string) => void;
}

const Ctx = createContext<ActiveWorkspaceValue>({
  workspaces: [],
  active: null,
  select: () => {},
});

/**
 * Which workspace the dashboard is showing.
 *
 * Held in context rather than fetched per page: every dashboard page needs it
 * to build its request, and each fetching independently would mean each
 * switching at a different moment.
 *
 * The cookie is still written, because API routes resolve the same choice
 * server-side — and they re-check it against real memberships, so this is a
 * preference, not a grant.
 */
export function ActiveWorkspaceProvider({
  workspaces,
  initialActiveId,
  children,
}: {
  workspaces: Workspace[];
  initialActiveId?: string;
  children: React.ReactNode;
}) {
  const [activeId, setActiveId] = useState(
    initialActiveId ?? workspaces[0]?.id ?? "",
  );

  const value = useMemo<ActiveWorkspaceValue>(
    () => ({
      workspaces,
      active: workspaces.find((w) => w.id === activeId) ?? workspaces[0] ?? null,
      select(id: string) {
        if (!workspaces.some((w) => w.id === id)) return;
        setActiveId(id);
        document.cookie = `${ACTIVE_WORKSPACE_COOKIE}=${id}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      },
    }),
    [workspaces, activeId],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The workspace in view, or `null` while the shell is still loading it. */
export function useActiveWorkspace(): Workspace | null {
  return useContext(Ctx).active;
}

export function useWorkspaceSwitcher(): ActiveWorkspaceValue {
  return useContext(Ctx);
}
