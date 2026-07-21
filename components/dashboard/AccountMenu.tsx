"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChartColumn,
  Wallet,
  Settings,
  LogOut,
  ChevronLeft,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { clearLoggedIn } from "@/lib/auth";

interface Row {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ROWS: Row[] = [
  { href: "/dashboard/analytics", label: "گزارش‌ها", icon: ChartColumn },
  { href: "/dashboard/finance", label: "مالی", icon: Wallet },
  { href: "/dashboard/settings", label: "تنظیمات", icon: Settings },
];

/** Account actions: reports, finance, settings, and exit (logout). */
export function AccountMenu() {
  const router = useRouter();

  function logout() {
    clearLoggedIn();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {ROWS.map((row) => {
        const Icon = row.icon;
        return (
          <Link
            key={row.href}
            href={row.href}
            className="flex items-center gap-3 px-5 py-4 outline-none transition-colors hover:bg-subtle focus-visible:bg-subtle"
          >
            <Icon className="size-5 shrink-0 text-muted" aria-hidden />
            <span className="flex-1 text-sm font-medium text-foreground">
              {row.label}
            </span>
            <ChevronLeft className="size-4 shrink-0 text-faint" aria-hidden />
          </Link>
        );
      })}

      <button
        type="button"
        onClick={logout}
        className={cn(
          "flex w-full items-center gap-3 px-5 py-4 text-start outline-none transition-colors",
          "text-danger hover:bg-subtle focus-visible:bg-subtle",
        )}
      >
        <LogOut className="size-5 shrink-0" aria-hidden />
        <span className="flex-1 text-sm font-medium">خروج از حساب</span>
      </button>
    </div>
  );
}
