"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  const pathname = usePathname();
  const { data, error, loading, reload } = useApi<Shell>("/api/me/workspaces");

  /**
   * The one dashboard route a non-manager is allowed to reach.
   *
   * Creating a workspace is what makes someone an organiser — there is no role
   * to flip — and the page that does it lived inside this layout, which turned
   * `NOT_A_MANAGER` into a redirect to `/me`. So the only door into being an
   * organiser was locked behind being one already, and the sole way through was
   * `/signup`, which a person who signed in through `/login` has no route to.
   */
  const isOnboarding = pathname === "/dashboard/workspaces/new";

  useEffect(() => {
    if (!error) return;
    if (isOnboarding) return;
    // `UNAUTHENTICATED` is handled in `apiFetch`, which clears the dead cookie
    // before navigating. Doing it here too was the bug: `router.replace` left
    // the cookie in place, so `middleware.ts` — which can only test for its
    // presence — read the visitor as signed in and bounced them off `/login`
    // right back to the dashboard.
    if (error.code === "NOT_A_MANAGER") router.replace("/me");
  }, [error, router, isOnboarding]);

  /*
    Bare, because there is no workspace yet to put in the chrome: no sidebar to
    switch between, no active workspace for the provider to hold. The page is
    self-contained and needs neither.
  */
  if (error?.code === "NOT_A_MANAGER" && isOnboarding) {
    return <div className="min-h-[100dvh]">{children}</div>;
  }

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
                className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
