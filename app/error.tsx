"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

/**
 * A page that threw.
 *
 * Nothing caught render errors anywhere in the tree, so one became Next's own
 * screen — in production, the bare line «Application error: a client-side
 * exception has occurred», in English, with no chrome and no way back. On a
 * ticket page, at a door, that is the whole product failing with no instruction
 * of any kind.
 *
 * `reset()` re-renders the segment without a full reload, which is genuinely
 * worth offering: most of what can throw here is a transient render against
 * half-arrived data, and trying again costs nothing.
 *
 * The `digest` is shown deliberately. Server errors are redacted before they
 * reach the browser — that is the point — so this hash is the only thing a
 * person can quote that ties their screen to a line in the log.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The boundary swallows it otherwise, and a client error nobody records is
    // one nobody fixes.
    console.error("[render]", error);
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
        <span className="mb-5 grid size-14 place-items-center rounded-full bg-danger/10 text-danger-text">
          <TriangleAlert className="size-7" aria-hidden />
        </span>
        <h1 className="text-xl font-bold text-foreground">
          این صفحه باز نشد
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          خطایی رخ داد و این بخش نمایش داده نشد. معمولاً با یک تلاش دوباره درست
          می‌شود.
        </p>
        <p className="mx-auto mt-3 max-w-sm text-xs leading-relaxed text-faint">
          اگر بلیت خریده‌اید، سفارش شما ثبت است و از «بلیت‌های من» در دسترس
          می‌ماند؛ کد پیگیری هم در پیامک تأیید شماست.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset} size="lg">
            تلاش دوباره
          </Button>
          <Link
            href="/me/tickets"
            className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
          >
            بلیت‌های من
          </Link>
        </div>
        {error.digest ? (
          <p dir="ltr" className="mt-6 font-mono text-[11px] text-faint">
            {error.digest}
          </p>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
