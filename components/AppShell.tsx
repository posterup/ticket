import { AppChrome } from "@/components/AppChrome";

/**
 * Logged-in mobile shell. When signed in, the route-aware AppChrome renders the
 * top bar + bottom nav on main tabs, or a back button (no bottom nav) on
 * second-level pages. Signed out, it renders nothing but the page — so the
 * bottom nav never appears for logged-out visitors. Desktop (`lg`) keeps its
 * own chrome, so the bars hide there.
 */
export function AppShell({
  loggedIn,
  children,
}: {
  loggedIn: boolean;
  children: React.ReactNode;
}) {
  if (!loggedIn) return <>{children}</>;

  return <AppChrome>{children}</AppChrome>;
}
