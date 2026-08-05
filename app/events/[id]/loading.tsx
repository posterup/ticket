import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import { EventDetailSkeleton } from "@/components/skeletons/EventDetailSkeleton";

/** `<main>` copied from `app/events/[id]/page.tsx`; keep the two identical. */
export default function Loading() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <EventDetailSkeleton />
      </main>
      <Footer />
    </div>
  );
}
