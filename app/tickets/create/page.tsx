import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Logo } from "@/components/Logo";
import { EventComposer } from "@/components/create/EventComposer";

export const metadata: Metadata = {
  title: "ساخت رویداد | پوستر",
  description:
    "رویداد خود را بسازید: مکان، سانس‌ها، انواع بلیت و تنظیمات حریم خصوصی.",
};

export default function CreateTicketPage() {
  return (
    <div className="min-h-[100dvh]">
      <header className="auth-mobile-hide border-b border-border">
        <div className="mx-auto flex h-18 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            aria-label="پوستر، صفحه اصلی"
            className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Logo />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted underline-offset-4 hover:text-foreground"
          >
            بازگشت
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            ساخت رویداد
          </h1>
          <p className="mt-2 text-sm text-muted">
            مکان، سانس‌ها، انواع بلیت و حریم خصوصی را در یک صفحه تنظیم کنید و
            پیش‌نمایش زنده را ببینید.
          </p>
        </div>

        <EventComposer />
      </main>
    </div>
  );
}
