"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Rss, Users, User, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface PublicNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ITEMS: PublicNavItem[] = [
  { href: "/", label: "خانه", icon: Home },
  { href: "/events", label: "رویدادها", icon: Compass },
  { href: "/feed", label: "دنبال‌شده‌ها", icon: Rss },
  { href: "/pages", label: "صفحه‌ها", icon: Users },
  { href: "/me", label: "من", icon: User },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * App-like bottom navigation for the public/attendee experience on phones.
 * Mirrors the top nav (hidden below `sm`), so small screens always get a
 * persistent, thumb-reachable nav bar. Hidden at `sm` and up where the header
 * nav takes over.
 */
export function PublicBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="ناوبری پایین"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur-lg sm:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[0.625rem] font-medium transition-colors",
                  active ? "text-foreground" : "text-faint hover:text-muted",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
