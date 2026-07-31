import Link from "next/link";
import { Compass } from "lucide-react";

import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
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
 * A Server Component, so it costs nothing until something 404s.
 *
 * Distinct from a *resource* that does not exist — a deleted event, an unknown
 * order code. Those are fetched client-side and answered by `AsyncState` in
 * place, with the page's own layout intact. This is only for a URL that never
 * corresponded to anything.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
        <span className="mb-5 grid size-14 place-items-center rounded-full bg-subtle text-muted">
          <Compass className="size-7" aria-hidden />
        </span>
        <h1 className="text-xl font-bold text-foreground">
          این صفحه پیدا نشد
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          نشانی‌ای که باز کرده‌اید وجود ندارد یا تغییر کرده است. اگر از پیامک یا
          لینکی به اینجا رسیده‌اید، ممکن است رویداد حذف شده باشد.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link href="/events" className={cn(buttonVariants({ size: "lg" }))}>
            دیدن رویدادها
          </Link>
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
          >
            صفحهٔ اصلی
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
