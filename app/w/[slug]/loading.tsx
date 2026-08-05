import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import { WorkspaceSkeleton } from "@/components/skeletons/WorkspaceSkeleton";

/** `<main>` copied from `app/w/[slug]/page.tsx`; keep the two identical. */
export default function Loading() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-12 sm:px-6">
        <WorkspaceSkeleton />
      </main>
      <Footer />
    </div>
  );
}
