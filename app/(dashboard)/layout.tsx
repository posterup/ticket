"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useApi } from "@/lib/client/api";
import { ActiveWorkspaceProvider } from "@/components/dashboard/ActiveWorkspace";
import { AsyncState } from "@/components/ui/async-state";
import { Logo } from "@/components/Logo";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileNavDrawer } from "@/components/dashboard/MobileNavDrawer";
import { WorkspaceSwitcher } from "@/components/dashboard/WorkspaceSwitcher";
import type { Workspace } from "@/types";

interface Shell {
  workspaces: Workspace[];
  activeWorkspaceId: string;
}

/**
 * The dashboard shell.
 *
 * Loads the caller's workspaces once and shares them through context, so every
 * page below can scope its own request without each fetching the list.
 *
 * Middleware already turns anonymous visitors away at the edge; this handles
 * the cases it deliberately cannot see — an expired session, and a signed-in
 * user who owns no workspace and belongs on the attendee side.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data, error, loading, reload } = useApi<Shell>("/api/me/workspaces");

  useEffect(() => {
    if (!error) return;
    if (error.code === "UNAUTHENTICATED") router.replace("/login?next=/dashboard");
    if (error.code === "NOT_A_MANAGER") router.replace("/me");
  }, [error, router]);

  if (!data) {
    return (
      <div className="min-h-[100dvh] p-6">
        <AsyncState loading={loading} error={error} onRetry={reload} />
      </div>
    );
  }

  return (
    <ActiveWorkspaceProvider
      workspaces={data.workspaces}
      initialActiveId={data.activeWorkspaceId}
    >
      <div className="lg:flex">
        <Sidebar />
        <div className="min-h-[100dvh] flex-1">
          <header className="auth-mobile-hide flex h-16 items-center justify-between gap-3 border-b border-border px-4 lg:hidden">
            <div className="flex items-center gap-2.5">
              <MobileNavDrawer />
              <Link
                href="/"
                aria-label="پوستر، صفحه اصلی"
                className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <Logo />
              </Link>
            </div>
            <div className="w-44">
              <WorkspaceSwitcher />
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </ActiveWorkspaceProvider>
  );
}
