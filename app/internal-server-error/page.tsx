"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ServerCrash } from "lucide-react";

import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import { ErrorScreen } from "@/components/ErrorScreen";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { takeErrorOrigin } from "@/lib/client/error-redirect";

/**
 * A 500 from the API, given a page of its own.
 *
 * `lib/server/http.ts` answers an unhandled server error with «خطای
 * غیرمنتظره‌ای رخ داد.» — and that sentence used to arrive as one red line
 * inside whatever layout the reader was in, via `AsyncState`. It read like a
 * form validation message for something that is not the reader's fault and
 * that no amount of re-reading will fix.
 *
 * `useApi` now sends them here instead. Only `useApi`: it owns a page's own
 * data, so a failure there means the page genuinely cannot render and there is
 * nothing on screen to lose. `apiFetch` at large does **not** bounce, because
 * it also carries seat holds, layout saves and refunds — redirecting out of one
 * of those would throw away a half-filled checkout or an unsaved seat map,
 * which is a worse outcome than the error it was reporting.
 */
export default function InternalServerErrorPage() {
  // Read after mount: `sessionStorage` does not exist during the server render,
  // and reading it in a lazy initializer would still mismatch on hydration.
  const [origin, setOrigin] = useState<string>();
  useEffect(() => setOrigin(takeErrorOrigin()), []);

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <ErrorScreen
        icon={ServerCrash}
        code="۵۰۰"
        tone="danger"
        title="مشکل از سمت ماست"
        description="سرور نتوانست این صفحه را آماده کند. این خطا ثبت شده و در حال بررسی است — کاری از شما اشتباه نبوده."
        note="اگر بلیت خریده‌اید، سفارش شما ثبت است و از «بلیت‌های من» در دسترس می‌ماند؛ کد پیگیری هم در پیامک تأیید شماست."
        actions={
          <>
            {/*
              A link when we know where they were, a reload when we do not.
              Either way the primary action is "put me back", not "go home" —
              a reader who was three steps into choosing a seat should not be
              returned to the front door.
            */}
            {origin ? (
              <Link
                href={origin}
                className={cn(buttonVariants({ size: "lg" }))}
              >
                تلاش دوباره
              </Link>
            ) : (
              <Button size="lg" onClick={() => window.location.reload()}>
                تلاش دوباره
              </Button>
            )}
            <Link
              href="/events"
              className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
            >
              دیدن رویدادها
            </Link>
          </>
        }
      />
      <Footer />
    </div>
  );
}
