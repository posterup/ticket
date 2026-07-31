"use client";

import type { ApiCallError } from "@/lib/client/api";
import { SkeletonBlock, type SkeletonVariant } from "@/components/ui/skeleton";

/**
 * The shared loading / error / empty states for client-fetched pages.
 *
 * Centralised so 23 pages do not each invent their own wording, and so an
 * expired session reads as "sign in again" rather than a bare failure.
 */
export function AsyncState({
  loading,
  error,
  empty,
  emptyLabel = "چیزی برای نمایش نیست.",
  onRetry,
  offlineHint,
  variant = "list",
  rows,
}: {
  loading: boolean;
  error: ApiCallError | null;
  empty?: boolean;
  emptyLabel?: string;
  onRetry?: () => void;
  /**
   * What to do when the request never reached the server.
   *
   * «ارتباط با سرور برقرار نشد.» plus a retry button is the right answer almost
   * everywhere and the wrong one on a ticket, where the reader is standing at a
   * door with no signal and retrying is the thing that just failed. The pages
   * that have a real fallback — the door accepts a typed order code, and the
   * confirmation SMS carries it — say so here.
   */
  offlineHint?: string;
  /** Shape the placeholder like the section it stands in for. */
  variant?: SkeletonVariant;
  rows?: number;
}) {
  if (loading) {
    /**
     * A shimmer, not the words «در حال بارگذاری…».
     *
     * The sentence said nothing about what was arriving, collapsed the layout
     * to one line and then shoved it back, and on a fast connection was a flash
     * of text nobody could read. Route-level `loading.tsx` files already
     * shimmered; the sections that fetch their own data did not, which is most
     * of the product.
     */
    return <SkeletonBlock variant={variant} rows={rows ?? 3} />;
  }

  if (error) {
    /**
     * An expired session is not an error message, it is a navigation.
     *
     * `apiFetch` has already cleared the dead cookie and started the trip to
     * `/login`; this only has to avoid flashing a red sentence in the fraction
     * of a second before it lands. So: keep shimmering. The reader sees a page
     * that is still loading, then the sign-in form — never a dead end that
     * tells them to «دوباره وارد شوید» without taking them anywhere.
     *
     * `NOT_A_MANAGER` deliberately does not come through here. That reader is
     * signed in perfectly well and simply has no workspace; the dashboard
     * layout sends them to `/me`, and calling their session expired was never
     * true.
     */
    if (error.code === "UNAUTHENTICATED") {
      return <SkeletonBlock variant={variant} rows={rows ?? 3} />;
    }
    return (
      <div role="alert" className="py-10 text-center">
        <p className="text-sm text-danger-text">{error.message}</p>
        {offlineHint && error.code === "NETWORK" ? (
          <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted">
            {offlineHint}
          </p>
        ) : null}
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            تلاش دوباره
          </button>
        ) : null}
      </div>
    );
  }

  if (empty) {
    return <p className="py-10 text-center text-sm text-muted">{emptyLabel}</p>;
  }
  return null;
}
