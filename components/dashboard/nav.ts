import {
  LayoutDashboard,
  CalendarDays,
  Users,
  User,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Primary destinations in the organizer dashboard (desktop sidebar order). */
export const SIDEBAR_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
  { href: "/dashboard/events", label: "رویدادها", icon: CalendarDays },
  { href: "/dashboard/customers", label: "مشتریان", icon: Users },
  { href: "/dashboard/profile", label: "پروفایل", icon: User },
];

/** Where the emphasized "Create" action points. */
export const CREATE_HREF = "/tickets/create";

/** Returns true when `href` is the active route for `pathname`. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
