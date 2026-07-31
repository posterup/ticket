"use client";

import Link from "next/link";

import { useApi } from "@/lib/client/api";
import { formatNumber } from "@/lib/format";
import { AsyncState } from "@/components/ui/async-state";

interface LayoutSummary {
  venueId: string;
  venueName: string;
  city: string;
  publishedVersion?: number;
  totalSeats?: number;
}

/** Every venue and whether it has a published seat map yet. */
export default function AdminVenuesPage() {
  const { data, error, loading, reload } =
    useApi<LayoutSummary[]>("/api/admin/venues");

  if (!data) {
    return <AsyncState loading={loading} error={error} onRetry={reload} variant="table" rows={5} />;
  }

  return (
    <>
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-foreground">سالن‌ها</h1>
        <p className="mt-1 text-sm text-muted">
          نقشه هر سالن یک‌بار طراحی می‌شود و رویدادها از آن استفاده می‌کنند.
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((venue) => (
          <li key={venue.venueId}>
            <Link
              href={`/admin/venues/${venue.venueId}`}
              className="flex h-full flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 outline-none transition-colors hover:border-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div>
                <h2 className="font-bold text-foreground">{venue.venueName}</h2>
                <p className="mt-0.5 text-xs text-muted">{venue.city}</p>
              </div>
              <p className="text-xs">
                {venue.publishedVersion ? (
                  <span className="text-success-text">
                    نسخه {formatNumber(venue.publishedVersion)} ·{" "}
                    {formatNumber(venue.totalSeats ?? 0)} صندلی
                  </span>
                ) : (
                  <span className="text-faint">هنوز نقشه‌ای ندارد</span>
                )}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
