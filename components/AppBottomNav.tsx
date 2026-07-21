"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Plus, User, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** The create action gets the accent color to stand out (same size). */
  accent?: boolean;
}

// Logged-in mobile nav — icons only, uniform size. RTL order (right→left):
// home (list of events) · contacts · create event · profile.
// Only mounted for signed-in users (see AppShell); never renders logged out.
const ITEMS: NavItem[] = [
  { href: "/dashboard/events", label: "خانه", icon: Home },
  { href: "/dashboard/customers", label: "مخاطبین", icon: Users },
  { href: "/tickets/create", label: "ساخت", icon: Plus, accent: true },
  { href: "/dashboard/profile", label: "پروفایل", icon: User },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="ناوبری اصلی"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur-lg lg:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-4 items-center px-2 py-2.5">
        {ITEMS.map((item) => (
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
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg py-1 text-[0.625rem] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
        item.accent
          ? "text-accent hover:brightness-110"
          : active
            ? "text-foreground"
            : "text-faint hover:text-muted",
      )}
    >
      <Icon className="size-5" aria-hidden />
      <span>{item.label}</span>
    </Link>
  );
}
