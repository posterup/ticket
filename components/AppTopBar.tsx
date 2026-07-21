import Link from "next/link";
import { Compass, Bell, type LucideIcon } from "lucide-react";

import { Logo } from "@/components/Logo";

/**
 * Logged-in mobile/tablet top bar: logo on one side, explore (search) and
 * notification actions on the other — icons only. Fixed to the top; desktop
 * keeps its section-specific chrome (landing header, sidebar), so this hides
 * at `lg`.
 */
export function AppTopBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-card/90 backdrop-blur-lg lg:hidden">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          aria-label="پوستر، صفحه اصلی"
          className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <Logo />
        </Link>

        <div className="flex items-center gap-1">
          <TopAction href="/events" label="جست‌وجو و کشف" icon={Compass} />
          <TopAction href="/dashboard/notifications" label="اعلان‌ها" icon={Bell} />
        </div>
      </div>
    </header>
  );
}

function TopAction({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="grid size-10 place-items-center rounded-full text-muted outline-none transition-colors hover:bg-subtle hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <Icon className="size-5" aria-hidden />
    </Link>
  );
}
