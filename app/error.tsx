"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import { ErrorScreen } from "@/components/ErrorScreen";
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
 *
 * No glyph: this boundary catches anything, so there is no status code to set
 * behind it, and inventing one would be a number that means nothing.
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
      <ErrorScreen
        icon={TriangleAlert}
        tone="danger"
        title="این صفحه باز نشد"
        description="خطایی رخ داد و این بخش نمایش داده نشد. معمولاً با یک تلاش دوباره درست می‌شود."
        note="اگر بلیت خریده‌اید، سفارش شما ثبت است و از «بلیت‌های من» در دسترس می‌ماند؛ کد پیگیری هم در پیامک تأیید شماست."
        actions={
          <>
            <Button onClick={reset} size="lg">
              تلاش دوباره
            </Button>
            <Link
              href="/me/tickets"
              className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
            >
              بلیت‌های من
            </Link>
          </>
        }
        footnote={
          error.digest ? (
            <p dir="ltr" className="font-mono text-[11px] text-faint">
              {error.digest}
            </p>
          ) : null
        }
      />
      <Footer />
    </div>
  );
}
