import { Home, Users, Compass, Bell, User, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Primary destinations, mirroring the mobile shell (bottom nav + top bar):
 * home (my events), contacts, explore, notifications. Organizer sub-tools and
 * Reports/Finance/Settings now live under the profile area, not the sidebar.
 */
export const SIDEBAR_ITEMS: NavItem[] = [
  { href: "/dashboard/events", label: "خانه", icon: Home },
  { href: "/dashboard/customers", label: "مخاطبین", icon: Users },
  { href: "/events", label: "کاوش", icon: Compass },
  { href: "/dashboard/notifications", label: "اعلان‌ها", icon: Bell },
];

/** Account destination, pinned to the bottom of the sidebar. */
export const PROFILE_ITEM: NavItem = {
  href: "/dashboard/profile",
  label: "پروفایل",
  icon: User,
};

/** Where the emphasized "Create" action points. */
export const CREATE_HREF = "/tickets/create";

/** Returns true when `href` is the active route for `pathname`. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
