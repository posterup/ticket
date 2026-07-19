import Link from "next/link";

import { Logo } from "@/components/Logo";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { BottomNav } from "@/components/dashboard/BottomNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="lg:flex">
      <Sidebar />
      <div className="min-h-[100dvh] flex-1">
        <header className="flex h-16 items-center border-b border-border px-4 lg:hidden">
          <Link
            href="/"
            aria-label="پوستر، صفحه اصلی"
            className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Logo />
          </Link>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6 pb-28 sm:px-6 lg:py-8 lg:pb-10">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
