import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="overflow-hidden rounded-xl border border-border">
          <Skeleton className="h-36 w-full rounded-none sm:h-52" />
          <div className="px-5 pb-6 sm:px-6">
            <Skeleton className="-mt-12 size-24 rounded-2xl sm:-mt-14 sm:size-28" />
            <Skeleton className="mt-3 h-7 w-48" />
            <Skeleton className="mt-2 h-5 w-20 rounded-full" />
            <Skeleton className="mt-3 h-4 w-64" />
            <Skeleton className="mt-4 h-10 w-32 rounded-md" />
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
