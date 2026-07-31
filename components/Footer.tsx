import Link from "next/link";

import { Logo } from "@/components/Logo";

/**
 * Minimal footer: brand mark, the organizer entry point, and a copyright line.
 *
 * The `/hosts` link is the only path from the attendee side of the product to
 * the organizer pitch, so it belongs on every public page rather than in a
 * single hero.
 */
export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:px-6">
        <Logo />
        <Link
          href="/hosts"
          className="rounded-lg outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          برگزارکننده هستید؟
        </Link>
        <p>© تمامی حقوق برای پوستر محفوظ است.</p>
      </div>
    </footer>
  );
}
