"use client";

import type { ApiCallError } from "@/lib/client/api";

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
}: {
  loading: boolean;
  error: ApiCallError | null;
  empty?: boolean;
  emptyLabel?: string;
  onRetry?: () => void;
}) {
  if (loading) {
    return (
      <p role="status" className="py-10 text-center text-sm text-muted">
        در حال بارگذاری…
      </p>
    );
  }

  if (error) {
    const expired =
      error.code === "UNAUTHENTICATED" || error.code === "NOT_A_MANAGER";
    return (
      <div role="alert" className="py-10 text-center">
        <p className="text-sm text-danger">
          {expired ? "نشست شما منقضی شده است. دوباره وارد شوید." : error.message}
        </p>
        {onRetry && !expired ? (
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
