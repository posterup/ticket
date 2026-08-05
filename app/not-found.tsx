"use client";

import Link from "next/link";
import { Compass } from "lucide-react";

import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import { ErrorScreen } from "@/components/ErrorScreen";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

/**
 * An address that matches nothing.
 *
 * There was no `not-found.tsx` anywhere, so an unmatched route fell through to
 * Next's built-in page: «404 | This page could not be found» — English, in a
 * left-to-right layout, with none of the site's chrome, inside a document
 * declared `lang="fa" dir="rtl"`. It reads less like a missing page than like a
 * broken site, which matters most for the people most likely to hit it: someone
 * following an old link from a message, or mistyping an event address.
 *
 * Distinct from a *resource* that does not exist — a deleted event, an unknown
 * order code. Those are fetched client-side and answered by `AsyncState` in
 * place, with the page's own layout intact. This is only for a URL that never
 * corresponded to anything.
 *
 * Shares `ErrorScreen` with the render-error and 500 pages: three dead ends
 * that look like three different products is how a reader concludes the site is
 * held together with tape.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <ErrorScreen
        icon={Compass}
        code="۴۰۴"
        title="این صفحه پیدا نشد"
        description="نشانی‌ای که باز کرده‌اید وجود ندارد یا تغییر کرده است. اگر از پیامک یا لینکی به اینجا رسیده‌اید، ممکن است رویداد حذف شده باشد."
        actions={
          <>
            <Link href="/events" className={cn(buttonVariants({ size: "lg" }))}>
              دیدن رویدادها
            </Link>
            <Link
              href="/"
              className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
            >
              صفحهٔ اصلی
            </Link>
          </>
        }
      />
      <Footer />
    </div>
  );
}
