"use client";

import { Skeleton as HeroSkeleton } from "@heroui/react";

import { cn } from "@/lib/utils";

/**
 * Shimmering placeholder block for loading states.
 *
 * HeroUI's `Skeleton` with `animationType="none"`, because the shimmer is the
 * brand's: the `.shimmer` class in `globals.css` sweeps a gradient built from
 * `--subtle`, and HeroUI's own pulse would either fight it or replace it with a
 * grey that is not one of our tokens. What the swap buys is the component's
 * `aria-hidden`/`role` handling and a single place to change the placeholder
 * shape, rather than a hand-rolled div.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <HeroSkeleton
      animationType="none"
      className={cn("shimmer rounded-md", className)}
      aria-hidden
    />
  );
}

/**
 * A region that is loading, announced once.
 *
 * `role="status"` sits on the wrapper rather than the blocks, so a screen
 * reader hears «در حال بارگذاری» a single time instead of walking a dozen
 * empty boxes. The blocks themselves are `aria-hidden`.
 */
export function SkeletonGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="در حال بارگذاری"
      className={cn("flex flex-col gap-3", className)}
    >
      {children}
    </div>
  );
}

export type SkeletonVariant = "list" | "cards" | "table" | "form" | "page";

/**
 * A placeholder shaped like the section that is coming.
 *
 * Route-level `loading.tsx` files have always shimmered; every *section* that
 * fetches its own data rendered the words «در حال بارگذاری…» instead — one line
 * of centred grey text where a table was about to be, which collapses the
 * layout and then shoves it back when the data lands.
 *
 * The variants exist because a placeholder of the wrong shape is its own layout
 * shift: a list must not be stood in for by a card.
 */
export function SkeletonBlock({
  variant = "list",
  rows = 3,
}: {
  variant?: SkeletonVariant;
  rows?: number;
}) {
  if (variant === "cards") {
    return (
      <SkeletonGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          >
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </SkeletonGroup>
    );
  }

  if (variant === "table") {
    return (
      <SkeletonGroup className="gap-0 divide-y divide-border overflow-hidden rounded-xl border border-border">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </SkeletonGroup>
    );
  }

  if (variant === "form") {
    return (
      <SkeletonGroup className="gap-4">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
        <Skeleton className="h-11 w-32" />
      </SkeletonGroup>
    );
  }

  if (variant === "page") {
    return (
      <SkeletonGroup className="gap-6">
        <Skeleton className="h-8 w-2/5" />
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-56 w-full rounded-xl" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      </SkeletonGroup>
    );
  }

  return (
    <SkeletonGroup>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
        >
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      ))}
    </SkeletonGroup>
  );
}
