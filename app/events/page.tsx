import type { Metadata } from "next";
import { headers } from "next/headers";

import {
  listEvents,
  minPriceByEvent,
  getWorkspacesByEvents,
  getEventEngagements,
} from "@/lib/server";
import { cityFromEnglish } from "@/lib/geo/iran";
import { formatJalaliDate, formatToman } from "@/lib/format";
import { modeLabel } from "@/lib/events/labels";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import {
  EventsExplorer,
  type DiscoverEvent,
} from "@/components/events/EventsExplorer";

export const metadata: Metadata = {
  title: "رویدادها | پوستر",
  description: "تجربه‌ها و رویدادهای جذاب اطرافتان را کشف کنید.",
};

function fromPrice(min: number | undefined): string | null {
  if (min === undefined) return null;
  return min === 0 ? "رایگان" : `از ${formatToman(min)}`;
}

export default async function PublicEventsPage() {
  const published = (await listEvents()).filter(
    (e) => e.status === "published",
  );
  const ids = published.map((e) => e.id);

  // Resolved in one batch each, rather than per row inside the map below.
  const [prices, orgs, engagement] = await Promise.all([
    minPriceByEvent(ids),
    getWorkspacesByEvents(ids),
    getEventEngagements(ids),
  ]);

  const withKey = published.map((event) => {
    const org = orgs.get(event.id);
    const firstSession = event.sessions[0];
    return {
      sortKey: firstSession?.startAt ?? "",
      event: {
        id: event.id,
        title: event.title,
        modeLabel: modeLabel(event.mode),
        city: event.venue.city,
        venueName: event.venue.name,
        dateLabel: firstSession ? formatJalaliDate(firstSession.startAt) : "",
        sortKey: firstSession?.startAt ?? "",
        price: fromPrice(prices.get(event.id)),
        going: engagement.get(event.id)?.going ?? 0,
        tags: event.tags,
        categories: event.categories ?? [],
        org: org
          ? {
              slug: org.slug,
              name: org.name,
              avatar: org.avatar,
              verified: Boolean(org.verified),
            }
          : null,
      } satisfies DiscoverEvent,
    };
  });
  withKey.sort((a, b) =>
    a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0,
  );
  const events = withKey.map((x) => x.event);

  // Default the city to the visitor's (IP geolocation), else Tehran.
  const hdrs = await headers();
  const geoRaw = hdrs.get("x-vercel-ip-city");
  const geoCity = geoRaw ? cityFromEnglish(decodeURIComponent(geoRaw)) : null;
  const eventCities = new Set(events.map((e) => e.city));
  const defaultCity =
    geoCity && eventCities.has(geoCity)
      ? geoCity
      : eventCities.has("تهران")
        ? "تهران"
        : "همه شهرها";

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <EventsExplorer events={events} defaultCity={defaultCity} />
      </main>
      <Footer />
    </div>
  );
}
