"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  Plus,
  User,
  Compass,
  Heart,
  Ticket,
  LogIn,
  Store,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useSession } from "@/lib/client/session";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** The create action gets the accent color to stand out (same size). */
  accent?: boolean;
}

/**
 * Two navs, because there are two kinds of signed-in person.
 *
 * This used to be one list of four organiser destinations shown to everyone
 * with a session — «خانه (داشبورد)» · «مخاطبین» · «ساخت رویداد» · «پروفایل».
 * An attendee got a contacts tab they have no contacts in, an accent-tinted
 * "create an event" button sitting under the payment form at checkout, and a
 * home tab that answered `NOT_A_MANAGER` and bounced them back to `/me`.
 *
 * Offering a control and then refusing it is worse than not offering it: the
 * reader learns the product is unreliable rather than that the door was never
 * theirs. So membership decides which four tabs exist, and the ones a person
 * cannot use are not rendered at all.
 *
 * Membership, not a role flag — there is no role column on `User`. Owning a
 * workspace is what makes someone an organiser (`createWorkspace` inserts the
 * `WorkspaceMember` row), which is the same test `/api/me/workspaces` applies
 * before it will answer the dashboard.
 */
const ORGANISER_ITEMS: NavItem[] = [
  { href: "/dashboard/events", label: "خانه", icon: Home },
  { href: "/dashboard/customers", label: "مخاطبین", icon: Users },
  { href: "/tickets/create", label: "ساخت", icon: Plus, accent: true },
  { href: "/dashboard/profile", label: "پروفایل", icon: User },
];

/**
 * Signed out, on a phone, there was no navigation whatsoever.
 *
 * `AppShell` mounted the tab bar only for a session, and `PublicHeader`'s links
 * are `hidden sm:flex` — so below 640px a visitor had a logo, «ورود», and no
 * way to reach anything else. On a product that ships mobile-only and whose
 * front door is discovery, that is the entire navigation missing for everyone
 * who has not signed in yet.
 *
 * Three tabs, not four: «دنبال‌شده‌ها» and «بلیت‌های من» need an account, and
 * the rule here is the same as for the organiser tabs — do not offer a control
 * that answers by refusing. Signing in is different from being refused, so it
 * gets a tab of its own.
 */
const GUEST_ITEMS: NavItem[] = [
  { href: "/events", label: "رویدادها", icon: Compass },
  { href: "/pages", label: "برگزارکنندگان", icon: Store },
  { href: "/login", label: "ورود", icon: LogIn, accent: true },
];

/** RTL order (right→left): explore · following · my tickets · me. */
const ATTENDEE_ITEMS: NavItem[] = [
  { href: "/events", label: "رویدادها", icon: Compass },
  { href: "/feed", label: "دنبال‌شده‌ها", icon: Heart },
  { href: "/me/tickets", label: "بلیت‌های من", icon: Ticket },
  { href: "/me", label: "من", icon: User },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppBottomNav() {
  const pathname = usePathname();
  const { user, memberships } = useSession();
  // Belonging to any workspace is what opens the dashboard, in any role.
  const items = !user
    ? GUEST_ITEMS
    : memberships.length > 0
      ? ORGANISER_ITEMS
      : ATTENDEE_ITEMS;

  return (
    <nav
      aria-label="ناوبری اصلی"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur-lg lg:hidden"
    >
      <div
        className="mx-auto grid max-w-md items-center px-2 py-2.5"
        // Column count follows the list; the guest bar has three tabs and a
        // hardcoded `grid-cols-4` would leave a gap where a fourth was.
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => (
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
        "flex flex-col items-center gap-1 rounded-lg py-1 text-[0.625rem] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        item.accent
          ? "text-accent-text hover:brightness-110"
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
