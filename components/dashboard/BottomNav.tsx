"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, User, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { CREATE_HREF, isActive } from "@/components/dashboard/nav";

/**
 * Mobile bottom navigation for logged-in event managers:
 * Profile (left), Create (center, emphasized), CRM (right).
 * Forced LTR so the three items keep their described left/center/right order.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      dir="ltr"
      aria-label="ناوبری اصلی"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur-lg lg:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-3 items-center px-6">
        <NavIcon
          href="/dashboard/profile"
          label="پروفایل"
          active={isActive(pathname, "/dashboard/profile")}
          icon={<User className="size-5" aria-hidden />}
        />

        <div className="flex justify-center">
          <Link
            href={CREATE_HREF}
            aria-label="ساخت رویداد"
            className="flex -translate-y-3 flex-col items-center gap-1"
          >
            <span className="grid size-12 place-items-center rounded-full bg-foreground text-background shadow-sm transition-transform active:scale-95">
              <Plus className="size-6" aria-hidden />
            </span>
            <span className="text-[0.625rem] font-medium text-muted">ساخت</span>
          </Link>
        </div>

        <NavIcon
          href="/dashboard/customers"
          label="مشتریان"
          active={isActive(pathname, "/dashboard/customers")}
          icon={<Users className="size-5" aria-hidden />}
        />
      </div>
    </nav>
  );
}

function NavIcon({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-1 py-1 text-[0.625rem] font-medium transition-colors",
        active ? "text-foreground" : "text-faint hover:text-muted",
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
