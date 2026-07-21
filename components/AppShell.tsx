import { AppTopBar } from "@/components/AppTopBar";
import { AppBottomNav } from "@/components/AppBottomNav";

/**
 * Logged-in mobile shell. When signed in, wraps the page with a fixed top bar
 * (logo + explore + profile) and the bottom nav, plus spacers so content clears
 * both. Signed out, it renders nothing but the page — so the bottom nav never
 * appears for logged-out visitors. Desktop (`lg`) keeps its own chrome, so the
 * bars hide there.
 */
export function AppShell({
  loggedIn,
  children,
}: {
  loggedIn: boolean;
  children: React.ReactNode;
}) {
  if (!loggedIn) return <>{children}</>;

  return (
    <>
      <AppTopBar />
      {/* Clears the fixed top bar. */}
      <div className="h-14 lg:hidden" aria-hidden />
      {children}
      {/* Clears the fixed bottom nav. */}
      <div className="h-16 lg:hidden" aria-hidden />
      <AppBottomNav />
    </>
  );
}
