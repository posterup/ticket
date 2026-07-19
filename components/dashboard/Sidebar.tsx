"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { buttonVariants } from "@/components/ui/button";
import { WorkspaceSwitcher } from "@/components/dashboard/WorkspaceSwitcher";
import { SIDEBAR_ITEMS, CREATE_HREF, isActive } from "@/components/dashboard/nav";
import type { Workspace } from "@/types";

/** Desktop sidebar navigation (hidden on mobile, where BottomNav takes over). */
export function Sidebar({ workspaces }: { workspaces: Workspace[] }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-[100dvh] w-64 shrink-0 flex-col border-s border-border bg-card px-4 py-6 lg:flex">
      <div className="px-2">
        <Link
          href="/"
          aria-label="پوستر، صفحه اصلی"
          className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <Logo />
        </Link>
      </div>

      <div className="mt-5">
        <WorkspaceSwitcher workspaces={workspaces} />
      </div>

      <Link
        href={CREATE_HREF}
        className={cn(buttonVariants({ variant: "primary", size: "md" }), "mt-4")}
      >
        <Plus aria-hidden />
        ساخت رویداد
      </Link>

      <nav className="mt-6 flex flex-col gap-1" aria-label="ناوبری داشبورد">
        {SIDEBAR_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-subtle text-foreground"
                  : "text-muted hover:bg-subtle hover:text-foreground",
              )}
            >
              <Icon className="size-[1.15rem]" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
