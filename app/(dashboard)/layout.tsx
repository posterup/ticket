"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { useApi } from "@/lib/client/api";
import { ActiveWorkspaceProvider } from "@/components/dashboard/ActiveWorkspace";
import { AsyncState } from "@/components/ui/async-state";
import { Logo } from "@/components/Logo";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
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
    The attendee frame, not the dashboard's and not nothing.

    This first rendered as a bare `<div>`, which was wrong twice over: no
    header, no footer, and no container, so the heading sat flush against the
    viewport edge on the one screen asking someone to commit to becoming an
    organiser. The dashboard chrome is equally wrong — there is no workspace yet
    for the sidebar to switch between and none for the provider to hold.

    So it wears what `/me` wears, because that is where the reader just came
    from and who they still are: an attendee, one tap into becoming a host.
    Narrower than `/me`'s `max-w-5xl` because this is a single short form and a
    5xl measure would strand its fields across a wide screen.

    A manager creating a *second* workspace never reaches this branch — they
    have `data`, so they get the full dashboard chrome below.
  */
  // `!data` rather than the error alone: the request is in flight before the
  // refusal arrives, and keying on the error meant a bare skeleton painted
  // first and the framed page replaced it. The chrome must not flicker on the
  // way to a page that asks someone for a commitment.
  if (isOnboarding && !data) {
    return (
      <div className="flex min-h-[100dvh] flex-col">
        <PublicHeader />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
          {children}
        </main>
        <Footer />
      </div>
    );
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
