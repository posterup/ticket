"use client";

import { useSession } from "@/lib/client/session";
import { AppChrome } from "@/components/AppChrome";
import { AppBottomNav } from "@/components/AppBottomNav";

/**
 * The mobile shell.
 *
 * Signed in, the route-aware `AppChrome` renders the top bar plus the tab bar
 * on main destinations, or a back button on second-level pages. Signed out,
 * the tab bar still appears — `PublicHeader` supplies the top bar for that
 * reader, and without the tabs there is no navigation at all below `sm`.
 *
 * Desktop (`lg`) keeps its own chrome, so both bars hide there.
 */
export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  // From the shared provider rather than its own fetch, so this and
  // `PublicHeader` cannot disagree about who is signed in — see
  // `lib/client/session.tsx`.
  const { user } = useSession();
  const loggedIn = Boolean(user);

  /**
   * Signed out still gets a tab bar — just not a top bar.
   *
   * This returned the bare page, and `PublicHeader`'s links are `hidden
   * sm:flex`, so below 640px a logged-out visitor had a logo, «ورود», and no
   * navigation of any kind. On a product that ships mobile-only and sends `/`
   * to discovery, that is every visitor who has not signed in yet.
   *
   * `AppBottomNav` alone rather than the whole of `AppChrome`: the top bar in
   * there is the signed-in one, and `PublicHeader` is already doing that job
   * for this reader. The spacer matches the one `AppChrome` uses, so the bar
   * never covers the end of a page.
   */
  if (!loggedIn) {
    return (
      <>
        {children}
        <div className="h-16 lg:hidden" aria-hidden />
        <AppBottomNav />
      </>
    );
  }

  return <AppChrome>{children}</AppChrome>;
}
