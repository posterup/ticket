import Link from "next/link";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { buttonVariants } from "@/components/ui/button";

/** Solid public header for content pages (events browsing). */
export function PublicHeader() {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          aria-label="پوستر، صفحه اصلی"
          className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <Logo />
        </Link>
        <Link
          href="/login"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          ورود
        </Link>
      </div>
    </header>
  );
}
