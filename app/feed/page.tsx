import type { Metadata } from "next";

import { listWorkspaces, listEventsByWorkspace, listTickets } from "@/lib/server";
import { formatJalaliDate, formatToman } from "@/lib/format";
import { MODE_LABELS } from "@/lib/events/labels";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import {
  FeedClient,
  type FeedEvent,
  type FeedWorkspace,
} from "@/components/feed/FeedClient";

export const metadata: Metadata = {
  title: "دنبال‌شده‌ها | پوستر",
  description: "رویدادهای صفحه‌هایی که دنبال می‌کنید.",
};

function fromPrice(eventId: string): string | null {
  const prices = listTickets(eventId).map((t) => t.price);
  if (prices.length === 0) return null;
  const min = Math.min(...prices);
  return min === 0 ? "رایگان" : `از ${formatToman(min)}`;
}

export default function FeedPage() {
  const workspaces = listWorkspaces();

  const withKey = workspaces.flatMap((w) =>
    listEventsByWorkspace(w.slug).map((e) => ({
      sortKey: e.sessions[0]?.startAt ?? "",
      event: {
        id: e.id,
        title: e.title,
        modeLabel: MODE_LABELS[e.mode],
        venue: `${e.venue.name}، ${e.venue.city}`,
        dateLabel: e.sessions[0] ? formatJalaliDate(e.sessions[0].startAt) : "",
        price: fromPrice(e.id),
        wsSlug: w.slug,
        wsName: w.name,
        wsAvatar: w.avatar,
        wsVerified: Boolean(w.verified),
      } satisfies FeedEvent,
    })),
  );
  withKey.sort((a, b) => (a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0));
  const events = withKey.map((x) => x.event);

  const feedWorkspaces: FeedWorkspace[] = workspaces.map((w) => ({
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
        <FeedClient events={events} workspaces={feedWorkspaces} />
      </main>
      <Footer />
    </div>
  );
}
