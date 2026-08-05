import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

/**
 * `/events/[id]`, before the event arrives.
 *
 * Mirrors the page's own two-column grid: the back link, then
 * `lg:grid-cols-[1fr_20rem]` with the poster, title, meta rows and buy card in
 * the main column and the sticky aside beside it. The aside is `lg:` only here
 * exactly as it is there, so the narrow layout does not reserve a column that
 * never appears.
 *
 * Shared with the in-page fallback. The route file and the page each drew their
 * own: the route drew this shape, the page fell back to the generic `page`
 * variant — a title, a paragraph and a 224px box — so arriving here meant
 * watching the right layout be replaced by the wrong one and then by the event.
 */
export function EventDetailSkeleton() {
  return (
    <SkeletonGroup className="gap-0">
      {/* «همه رویدادها» */}
      <Skeleton className="h-5 w-28" />

      <div className="mt-4 grid gap-10 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-8">
          <Skeleton className="aspect-[16/9] w-full rounded-2xl" />

          <div>
            {/* `text-3xl sm:text-4xl` — 36px, then 40px. */}
            <Skeleton className="h-9 w-4/5 sm:h-10" />
            {/* Organiser chip: a real pill, not a bar. */}
            <Skeleton className="mt-3 h-9 w-44 rounded-full" />
            {/* Venue + one session, at `text-sm` line height and `gap-1`. */}
            <div className="mt-3 flex flex-col gap-1">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-5 w-64" />
            </div>
          </div>

          {/* Buy card (mobile position), description, then the details block. */}
          <Skeleton className="h-40 w-full rounded-2xl" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-11/12" />
            <Skeleton className="h-5 w-4/6" />
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>

        <div className="hidden lg:flex lg:flex-col lg:gap-6">
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </div>
    </SkeletonGroup>
  );
}
