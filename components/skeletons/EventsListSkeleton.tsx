import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

/**
 * `/events`, before it has anything to show.
 *
 * Shaped against `EventsExplorer` line for line — the filter chips, the search
 * field, the hero carousel, then the category grids — because the placeholder
 * that stood here was shaped against nothing in particular. It opened with a
 * page title and a subtitle that the explorer does not have, then drew the
 * categories as a horizontal strip of `w-64` cards when they render as a
 * 2/3/4-column grid. Every one of those is a shift the reader watches happen.
 *
 * Exported rather than inlined into `loading.tsx` because the route-level
 * placeholder is not the only one: the page fetches its own data, so it renders
 * a second placeholder after hydration. Two files meant two shapes and two
 * shifts — one on the way in, one on the way to the data. One component means
 * the geometry is identical throughout and only the shimmer stops.
 *
 * The card block below matches `EventCard`'s exact rhythm: `aspect-video`
 * cover, then `mt-2` and four lines at `gap-1` whose heights are the line-box
 * heights of the text they stand for (`text-sm` = 20px, `text-xs` = 16px). It
 * is the same total height, so nothing below it moves.
 */
export function EventsListSkeleton() {
  return (
    <SkeletonGroup className="gap-8">
      {/* Filter chips + search — `EventsExplorer`'s own `gap-4` stack. */}
      <div className="flex flex-col gap-4">
        <div className="-mx-4 flex gap-2 px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {["w-16", "w-12", "w-20", "w-14", "w-24", "w-16"].map((w, i) => (
            <Skeleton key={i} className={`h-9 shrink-0 rounded-full ${w}`} />
          ))}
        </div>
        <Skeleton className="h-12 w-full rounded-full" />
      </div>

      {/* Hero carousel + its dots. */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-52 w-full rounded-2xl sm:h-72" />
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="size-2 rounded-full" />
          ))}
        </div>
      </div>

      {/* Category sections. Two, because a third would push the fold down
          further than the real page does on a first paint. */}
      {Array.from({ length: 2 }, (_, s) => (
        <section key={s} className="flex flex-col gap-5">
          <div className="flex items-baseline gap-2">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-4 w-10" />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        </section>
      ))}
    </SkeletonGroup>
  );
}

/** One `EventCard`, at its exact height. */
export function EventCardSkeleton() {
  return (
    <div className="flex w-full flex-col">
      <Skeleton className="aspect-video w-full rounded-xl" />
      <div className="mt-2 flex flex-col gap-1">
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-0.5 h-5 w-1/2" />
      </div>
    </div>
  );
}
