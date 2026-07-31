"use client";

import { useApi } from "@/lib/client/api";
import { AsyncState } from "@/components/ui/async-state";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import { MyEventsClient, type MeEvent } from "@/components/me/MyEventsClient";
import type { DiscoverEvent } from "@/components/events/EventsExplorer";
import type { RsvpState } from "@/lib/rsvp";
import type { Event, Workspace } from "@/types";

interface Bookmark {
  event: Event;
  state: "interested" | "going";
}

export default function MePage() {
  const bookmarks = useApi<Bookmark[]>("/api/me/bookmarks");
  const following = useApi<Workspace[]>("/api/me/following");
  // Reused for the labels the cards show — dates and prices are formatted
  // server-side so every surface reads the same.
  const discover = useApi<DiscoverEvent[]>("/api/events/discover");

  const byId = new Map((discover.data ?? []).map((d) => [d.id, d]));

  const events: (MeEvent & { state: RsvpState })[] = (bookmarks.data ?? []).map(
    ({ event, state }) => {
      const d = byId.get(event.id);
      return {
        id: event.id,
        title: event.title,
        city: event.venue.city,
        venueName: event.venue.name,
        dateLabel: d?.dateLabel ?? "",
        price: d?.price ?? null,
        tags: event.tags,
        org: d?.org
          ? { name: d.org.name, avatar: d.org.avatar, verified: d.org.verified }
          : null,
        state,
      };
    },
  );

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            من
          </h1>
          <p className="mt-2 text-sm text-muted">
            رویدادهایی که نشان کرده‌اید و صفحه‌هایی که دنبال می‌کنید.
          </p>
        </div>

        {bookmarks.data ? (
          <MyEventsClient
            events={events}
            followCount={(following.data ?? []).length}
          />
        ) : (
          <AsyncState
            loading={bookmarks.loading}
            error={bookmarks.error}
            onRetry={bookmarks.reload}
          variant="list" rows={3} />
        )}
      </main>
      <Footer />
    </div>
  );
}
