import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Logo } from "@/components/Logo";
import { CreateTicketWizard } from "@/components/wizard/CreateTicketWizard";

export const metadata: Metadata = {
  title: "ساخت بلیت | پوستر",
  description:
    "رویداد خود را در سه مرحله بسازید: اطلاعات رویداد، زمان‌بندی و انواع بلیت.",
};

export default function CreateTicketPage() {
  return (
    <div className="min-h-[100dvh]">
      <header className="border-b border-border">
        <div className="mx-auto flex h-18 max-w-3xl items-center justify-between px-4 sm:px-6">
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

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            ساخت بلیت جدید
          </h1>
          <p className="mt-2 text-sm text-muted">
            رویداد خود را در سه مرحله بسازید: اطلاعات رویداد، زمان‌بندی و انواع
            بلیت.
          </p>
        </div>

        <CreateTicketWizard />
      </main>
    </div>
  );
}
