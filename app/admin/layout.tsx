"use client";

import Link from "next/link";

import { useApi } from "@/lib/client/api";
import { AsyncState } from "@/components/ui/async-state";
import { Logo } from "@/components/Logo";

/**
 * The internal-ops shell.
 *
 * Middleware turns anonymous visitors away at the edge and every `/api/admin`
 * route calls `requirePlatformAdmin()`. This handles the case neither can: a
 * signed-in *organiser* who followed a link here. The list endpoint is the
 * cheapest thing that answers "is this caller staff", so it doubles as the gate.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data, error, loading, reload } = useApi<unknown[]>("/api/admin/venues");

  if (!data) {
    return (
      <div className="grid min-h-[100dvh] place-items-center p-6">
        <AsyncState loading={loading} error={error} onRetry={reload} />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh]">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="پوستر، صفحه اصلی">
              <Logo />
            </Link>
            <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent-text">
              پنل داخلی
            </span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/admin/venues"
              className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
            >
              سالن‌ها
            </Link>
            <Link
              href="/admin/payouts"
              className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
            >
              برداشت‌ها
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
