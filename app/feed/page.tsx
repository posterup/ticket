"use client";

import { useApi } from "@/lib/client/api";
import { AsyncState } from "@/components/ui/async-state";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import {
  FeedClient,
  type FeedEvent,
  type FeedWorkspace,
} from "@/components/feed/FeedClient";
import type { DiscoverEvent } from "@/components/events/EventsExplorer";
import type { Event, Workspace } from "@/types";

export default function FeedPage() {
  // Scoped server-side to the workspaces this viewer follows.
  const feed = useApi<Event[]>("/api/me/feed");
  const following = useApi<Workspace[]>("/api/me/following");
  // Suggestions for an empty feed come from the whole directory.
  const directory = useApi<Workspace[]>("/api/workspaces");
  const discover = useApi<DiscoverEvent[]>("/api/events/discover");

  const byId = new Map((discover.data ?? []).map((d) => [d.id, d]));

  const events: FeedEvent[] = (feed.data ?? []).map((e) => {
    const d = byId.get(e.id);
    return {
      id: e.id,
      title: e.title,
      modeLabel: d?.modeLabel ?? null,
      poster: d?.poster ?? null,
      venue: `${e.venue.name}، ${e.venue.city}`,
      dateLabel: d?.dateLabel ?? "",
      price: d?.price ?? null,
      tags: e.tags,
      wsSlug: d?.org?.slug ?? "",
      wsName: d?.org?.name ?? "",
      wsAvatar: d?.org?.avatar ?? "",
      wsVerified: Boolean(d?.org?.verified),
    };
  });

  const suggestions: FeedWorkspace[] = (directory.data ?? []).map((w) => ({
    slug: w.slug,
    name: w.name,
    avatar: w.avatar,
    type: w.type,
  }));

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            دنبال‌شده‌ها
          </h1>
          <p className="mt-2 text-sm text-muted">
            رویدادهای صفحه‌هایی که دنبال می‌کنید.
          </p>
        </div>

        {feed.data ? (
          <FeedClient
            events={events}
            workspaces={suggestions}
            followingCount={(following.data ?? []).length}
          />
        ) : (
          <AsyncState
            loading={feed.loading}
            error={feed.error}
            onRetry={feed.reload}
          variant="cards" rows={6} />
        )}
      </main>
      <Footer />
    </div>
  );
}
