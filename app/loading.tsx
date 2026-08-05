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
/**
 * It must not pretend to know the page.
 *
 * This drew a page title, a subtitle and a six-card grid inside `max-w-4xl` —
 * a specific layout, for a set of routes that share nothing with it or with
 * each other. `/feed` is `max-w-2xl`, `/pages` and `/me` are `max-w-5xl`,
 * `/orders/[code]` is `max-w-lg`, and the landing page is a hero. So the one
 * placeholder that runs on the widest range of routes was the one guaranteed to
 * be wrong on all of them, and the shift it caused was the whole page moving
 * sideways as well as up.
 *
 * A route whose shape is worth promising has its own `loading.tsx` (`/events`,
 * `/events/[id]`, `/w/[slug]`) and its own skeleton component, shared with the
 * page's in-body fallback. What is left here is the fallback for everything
 * else, and the honest thing for it to show is the chrome plus enough height to
 * hold the fold — not a guess at a body it cannot know.
 *
 * The height matters and is the reason this is not simply empty: `min-h`
 * reserves the viewport, so the `Footer` does not fly up to sit under the
 * header and then drop back down when the page renders.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <main
        role="status"
        aria-busy="true"
        aria-label="در حال بارگذاری"
        className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-10 sm:px-6"
      >
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="min-h-64 flex-1 rounded-2xl" />
      </main>
      <Footer />
    </div>
  );
}
