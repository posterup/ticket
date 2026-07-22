"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { AppTopBar } from "@/components/AppTopBar";
import { AppBottomNav } from "@/components/AppBottomNav";

/**
 * Top-level destinations (bottom-nav tabs + top-bar actions). On these the full
 * shell shows — top bar + bottom nav. Everything else is a "second-level" page:
 * the bottom nav is hidden and a back button replaces the top bar.
 */
const MAIN_ROUTES = new Set([
  "/dashboard/events", // home (my events)
  "/dashboard/customers", // contacts
  "/dashboard/profile", // profile
  "/dashboard/notifications", // notifications
  "/tickets/create", // create
]);

/**
 * Explore is exempt from the second-level rule: browsing pages (`/events` and
 * its detail/checkout routes) always keep the full shell.
 */
function isExplore(pathname: string): boolean {
  return pathname === "/events" || pathname.startsWith("/events/");
}

function isMain(pathname: string): boolean {
  return MAIN_ROUTES.has(pathname) || isExplore(pathname);
}

/** Route-aware mobile chrome for signed-in users (hidden at `lg`). */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isMain(pathname)) {
    return (
      <>
        <AppTopBar />
        <div className="h-14 lg:hidden" aria-hidden />
        {children}
        <div className="h-16 lg:hidden" aria-hidden />
        <AppBottomNav />
      </>
    );
  }

  // Second-level page: back button, no bottom nav.
  return (
    <>
      <BackBar />
      <div className="h-14 lg:hidden" aria-hidden />
      {children}
    </>
  );
}

function BackBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [title, setTitle] = useState("");

  // Show the current page's title next to the back arrow. Derived from the
  // document title (set per-page via metadata), stripped of the " | پوستر"
  // suffix, so it works for every second-level page without extra plumbing.
  useEffect(() => {
    const raw = typeof document !== "undefined" ? document.title : "";
    setTitle(raw.split("|")[0].trim());
  }, [pathname]);

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-card/90 backdrop-blur-lg lg:hidden">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-2">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="بازگشت"
          className="grid size-10 shrink-0 place-items-center rounded-full text-foreground outline-none transition-colors hover:bg-subtle focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <ArrowRight className="size-5" aria-hidden />
        </button>
        <span className="truncate text-lg font-bold text-foreground">
          {title}
        </span>
      </div>
    </header>
  );
}
