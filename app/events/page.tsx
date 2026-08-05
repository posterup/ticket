"use client";

import { useApi } from "@/lib/client/api";
import { AsyncState } from "@/components/ui/async-state";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import {
  EventsExplorer,
  type DiscoverEvent,
} from "@/components/events/EventsExplorer";
import { EventsListSkeleton } from "@/components/skeletons/EventsListSkeleton";

export default function PublicEventsPage() {
  const { data, error, loading, reload } =
    useApi<DiscoverEvent[]>("/api/events/discover");

  // City used to come from the visitor's IP, which needed a server render.
  // Tehran is the sensible default and the filter is one tap away.
  const cities = new Set((data ?? []).map((e) => e.city));
  const defaultCity = cities.has("تهران") ? "تهران" : "همه شهرها";

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {data ? (
          <EventsExplorer events={data} defaultCity={defaultCity} />
        ) : (
          // The same skeleton `loading.tsx` just drew, so hydration does not
          // swap one placeholder shape for another before the data lands.
          <AsyncState
            loading={loading}
            error={error}
            onRetry={reload}
            placeholder={<EventsListSkeleton />}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
