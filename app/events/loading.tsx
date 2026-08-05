import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import { EventsListSkeleton } from "@/components/skeletons/EventsListSkeleton";

/**
 * The `<main>` classes here are copied from `app/events/page.tsx` and must stay
 * copied. A placeholder in a container of a different width or padding moves
 * the whole page when the real one replaces it, however well the blocks inside
 * are shaped — and this one ran `py-10` against the page's `py-8 sm:py-10`.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <EventsListSkeleton />
      </main>
      <Footer />
    </div>
  );
}
