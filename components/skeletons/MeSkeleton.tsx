import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

/**
 * `/me`, before the bookmarks call answers.
 *
 * The generic `list` variant stood here — three bordered cards with two lines
 * each — while the page actually opens with a two-up grid of quick links and
 * then the tickets area. Neither the shape nor the height matched, so the whole
 * page re-laid out on arrival.
 *
 * Sized to the same rhythm `MyEventsClient` uses (`gap-8` between blocks) and to
 * `MyTicketsSection`'s 84px rows, so the tickets area does not move a second
 * time when its own request resolves a moment later.
 */
export function MeSkeleton() {
  return (
    <SkeletonGroup className="gap-8">
      {/* Quick links: صفحه‌ها + داشبورد برگزارکننده */}
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-4"
          >
            <Skeleton className="size-10 shrink-0 rounded-md" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        ))}
      </div>

      {/* Tickets area */}
      <div>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="flex h-[84px] flex-col justify-center gap-2 rounded-xl border border-border bg-card px-4"
            >
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonGroup>
  );
}
