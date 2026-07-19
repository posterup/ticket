"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Rss, User, Plus, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// One nav for the whole app (public + dashboard), shown on mobile/tablet.
// Organizer tools (CRM, analytics…) live under «من» and the dashboard drawer.
const LEFT: NavItem[] = [
  { href: "/", label: "خانه", icon: Home },
  { href: "/events", label: "رویدادها", icon: Compass },
];
const RIGHT: NavItem[] = [
  { href: "/feed", label: "دنبال‌شده‌ها", icon: Rss },
  { href: "/me", label: "من", icon: User },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppBottomNav() {
  const pathname = usePathname();
  const createActive = isActive(pathname, "/tickets/create");

  return (
    <nav
      aria-label="ناوبری اصلی"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur-lg lg:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 items-center px-2">
        {LEFT.map((item) => (
          <NavTab key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}

        <div className="flex justify-center">
          <Link
            href="/tickets/create"
            aria-label="ساخت رویداد"
            aria-current={createActive ? "page" : undefined}
            className="flex -translate-y-3 flex-col items-center gap-1"
          >
            <span className="grid size-12 place-items-center rounded-full bg-foreground text-background shadow-sm transition-transform active:scale-95">
              <Plus className="size-6" aria-hidden />
            </span>
            <span className="text-[0.625rem] font-medium text-muted">ساخت</span>
          </Link>
        </div>

        {RIGHT.map((item) => (
          <NavTab key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </div>
    </nav>
  );
}

function NavTab({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
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
  );
}
