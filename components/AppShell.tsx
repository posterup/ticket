"use client";

import { useSession } from "@/lib/client/session";
import { AppChrome } from "@/components/AppChrome";

/**
 * Logged-in mobile shell. When signed in, the route-aware AppChrome renders the
 * top bar + bottom nav on main tabs, or a back button (no bottom nav) on
 * second-level pages. Signed out, it renders nothing but the page — so the
 * bottom nav never appears for logged-out visitors. Desktop (`lg`) keeps its
 * own chrome, so the bars hide there.
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

  // Until it resolves, render the logged-out chrome: it is the smaller shell,
  // so the page does not jump when a signed-in visitor's session arrives.
  if (!loggedIn) return <>{children}</>;

  return <AppChrome>{children}</AppChrome>;
}
