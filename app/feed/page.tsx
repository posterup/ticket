import type { Metadata } from "next";

import {
  listFeedEvents,
  listFollowedWorkspaces,
  listWorkspaces,
  minPriceByEvent,
  getWorkspacesByEvents,
} from "@/lib/server";
import { getCurrentUser } from "@/lib/server/auth/guards";
import { formatJalaliDate, formatToman } from "@/lib/format";
import { modeLabel } from "@/lib/events/labels";
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

function fromPrice(min: number | undefined): string | null {
  if (min === undefined) return null;
  return min === 0 ? "رایگان" : `از ${formatToman(min)}`;
}

/**
 * The viewer's feed.
 *
 * Scoped in the query. Previously every event in the system was sent to the
 * browser, which then filtered them against a localStorage set — so the "feed"
 * was a client-side illusion over the full catalogue.
 */
export default async function FeedPage() {
  const user = await getCurrentUser();

  // Middleware sends signed-out visitors to /login, so this is the fallback
  // rather than the common path.
  const [events, followed] = user
    ? await Promise.all([
        listFeedEvents(user.id),
        listFollowedWorkspaces(user.id),
      ])
    : [[], []];

  const ids = events.map((e) => e.id);
  const [prices, orgs] = await Promise.all([
    minPriceByEvent(ids),
    getWorkspacesByEvents(ids),
  ]);

  const withKey = events.map((e) => {
    const org = orgs.get(e.id);
    return {
      sortKey: e.sessions[0]?.startAt ?? "",
      event: {
        id: e.id,
        title: e.title,
        modeLabel: modeLabel(e.mode),
        venue: `${e.venue.name}، ${e.venue.city}`,
        dateLabel: e.sessions[0] ? formatJalaliDate(e.sessions[0].startAt) : "",
        price: fromPrice(prices.get(e.id)),
        tags: e.tags,
        wsSlug: org?.slug ?? "",
        wsName: org?.name ?? "",
        wsAvatar: org?.avatar ?? "",
        wsVerified: Boolean(org?.verified),
      } satisfies FeedEvent,
    };
  });
  withKey.sort((a, b) =>
    a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0,
  );

  // Suggestions for an empty feed come from the whole directory.
  const suggestions: FeedWorkspace[] = (await listWorkspaces()).map((w) => ({
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
        <FeedClient
          events={withKey.map((x) => x.event)}
          workspaces={suggestions}
          followingCount={followed.length}
        />
      </main>
      <Footer />
    </div>
  );
}
