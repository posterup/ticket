import Link from "next/link";

import { redirect } from "next/navigation";

import { getCurrentUser, listMemberships } from "@/lib/server/auth/guards";
import { listWorkspaces } from "@/lib/server";
import { Logo } from "@/components/Logo";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileNavDrawer } from "@/components/dashboard/MobileNavDrawer";
import { WorkspaceSwitcher } from "@/components/dashboard/WorkspaceSwitcher";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The real gate. Middleware only checks that a cookie exists; this catches
  // an expired session, and a signed-in user who owns no workspace.
  //
  // Written as plain conditions rather than try/catch around requireManager():
  // `redirect()` works by throwing, so catching around it swallows the very
  // signal it depends on. Neither case is exceptional here anyway.
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  const memberships = await listMemberships(user.id);
  if (memberships.length === 0) redirect("/me");

  const workspaces = await listWorkspaces();

  return (
    <div className="lg:flex">
      <Sidebar workspaces={workspaces} />
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
            <WorkspaceSwitcher workspaces={workspaces} />
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
