import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The fallback shimmer, for every route without a nearer one.
 *
 * It had no `PublicHeader` and no `Footer`, while `events/`, `events/[id]/` and
 * `w/[slug]/` all do. That mattered because of where the chrome lives: for a
 * signed-in reader `AppShell` renders `AppChrome` in the *layout*, above this,
 * so it survives the transition — but for an anonymous one `AppShell` returns
 * bare children and every page draws its own header. So on the routes that fall
 * back here, the site's chrome vanished for the length of the navigation and
 * came back.
 *
 * Those routes are the ones an anonymous buyer actually walks: the landing
 * page, `/pages`, `/hosts`, sign-in — and `/orders/[code]`, which is where the
 * payment gateway returns them. Watching the header disappear on the way back
 * from paying is the worst moment to look broken.
 *
 * `PublicHeader` carries `auth-mobile-hide`, so a signed-in reader on mobile
 * does not get a second header stacked on `AppChrome`'s — the same arrangement
 * the three route-specific files above already rely on.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-3 h-4 w-72" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border p-4">
              <Skeleton className="aspect-video w-full rounded-lg" />
              <Skeleton className="mt-3 h-4 w-3/4" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
