import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Skeleton className="h-12 flex-1 rounded-full" />
          <Skeleton className="h-12 w-40 rounded-full" />
        </div>

        <Skeleton className="mt-6 h-52 w-full rounded-2xl sm:h-72" />

        {Array.from({ length: 2 }).map((_, row) => (
          <div key={row} className="mt-8">
            <Skeleton className="h-6 w-32" />
            <div className="mt-3 flex gap-4 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-64 shrink-0 sm:w-72">
                  <Skeleton className="aspect-video w-full rounded-xl" />
                  <Skeleton className="mt-2 h-4 w-3/4" />
                  <Skeleton className="mt-2 h-3 w-1/2" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>
      <Footer />
    </div>
  );
}
