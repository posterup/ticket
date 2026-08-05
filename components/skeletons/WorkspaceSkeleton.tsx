import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

/**
 * `/w/[slug]`, before the organiser page arrives.
 *
 * The placeholder this replaces was drawn against a layout the page no longer
 * has: a bordered card, a `-mt-12` avatar tile overlapping the banner, and a
 * status chip. None of those exist — the page is a plain banner, a name, a bio,
 * a follow button and a timeline — so the shimmer promised an avatar that never
 * came and reserved roughly 100px of height for things that were not on their
 * way. It also opened with `py-10` where the page has no top padding at all,
 * which pushed the banner down and then yanked it back up.
 *
 * The timeline below is `WorkspaceEvents`: a rail with a dot per group, and
 * cards whose height is set by a `size-20 sm:size-24` thumbnail.
 */
export function WorkspaceSkeleton() {
  return (
    <SkeletonGroup className="gap-0">
      <Skeleton className="h-36 w-full rounded-xl sm:h-52" />

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {/* `text-2xl` — 32px line box. */}
          <Skeleton className="h-8 w-48" />
          <div className="mt-2 flex flex-col gap-1.5">
            <Skeleton className="h-5 w-full max-w-prose" />
            <Skeleton className="h-5 w-2/3 max-w-prose" />
          </div>
        </div>
        {/* The follow button is full-width on mobile and `w-40` beside the
            name from `sm` up — same as `WorkspaceFollow`. */}
        <Skeleton className="h-11 w-full shrink-0 rounded-md sm:w-40" />
      </div>

      <div className="mt-10 flex flex-col">
        {Array.from({ length: 2 }, (_, g) => (
          <section key={g} className="flex flex-col">
            <div className="flex gap-4">
              <div className="flex w-3 shrink-0 justify-center">
                <span className="w-px bg-border" aria-hidden />
              </div>
              <Skeleton className="my-2 h-5 w-24" />
            </div>
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="flex gap-4">
                <div className="relative flex w-3 shrink-0 justify-center">
                  <span className="absolute inset-y-0 w-px bg-border" aria-hidden />
                  <Skeleton className="relative mt-6 size-3 rounded-full" />
                </div>
                <div className="min-w-0 flex-1 pb-4">
                  <div className="flex gap-4 rounded-xl border border-border bg-card p-3">
                    <Skeleton className="size-20 shrink-0 rounded-lg sm:size-24" />
                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
                      <Skeleton className="h-5 w-3/5" />
                      <Skeleton className="h-4 w-2/5" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </SkeletonGroup>
  );
}
