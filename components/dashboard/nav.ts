import {
  LayoutDashboard,
  CalendarDays,
  Ticket,
  ChartColumn,
  ScanLine,
  Megaphone,
  Percent,
  Wallet,
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
  { href: "/dashboard/tickets/customize", label: "قالب بلیت", icon: Ticket },
  { href: "/dashboard/analytics", label: "تحلیل", icon: ChartColumn },
  { href: "/dashboard/checkin", label: "پذیرش", icon: ScanLine },
  { href: "/dashboard/marketing", label: "بازاریابی", icon: Megaphone },
  { href: "/dashboard/promotions", label: "تخفیف‌ها", icon: Percent },
  { href: "/dashboard/finance", label: "مالی", icon: Wallet },
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
