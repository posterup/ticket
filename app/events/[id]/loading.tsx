import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <Skeleton className="h-4 w-28" />
        <div className="mt-4 grid gap-10 lg:grid-cols-[1fr_20rem] lg:items-start">
          <div className="flex flex-col gap-8">
            <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
            <div>
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="mt-3 h-4 w-40" />
            </div>
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
          <div className="hidden lg:flex lg:flex-col lg:gap-6">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
