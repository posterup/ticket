import type { Metadata } from "next";
import { headers } from "next/headers";

import {
  listEvents,
  listTickets,
  getWorkspaceByEvent,
  getEventEngagement,
} from "@/lib/server";
import { cityFromEnglish } from "@/lib/geo/iran";
import { formatJalaliDate, formatToman } from "@/lib/format";
import { MODE_LABELS } from "@/lib/events/labels";
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

function fromPrice(eventId: string): string | null {
  const prices = listTickets(eventId).map((t) => t.price);
  if (prices.length === 0) return null;
  const min = Math.min(...prices);
  return min === 0 ? "رایگان" : `از ${formatToman(min)}`;
}

export default async function PublicEventsPage() {
  const withKey = listEvents()
    .filter((e) => e.status === "published")
    .map((event) => {
      const org = getWorkspaceByEvent(event.id);
      const firstSession = event.sessions[0];
      return {
        sortKey: firstSession?.startAt ?? "",
        event: {
          id: event.id,
          title: event.title,
          modeLabel: MODE_LABELS[event.mode],
          city: event.venue.city,
          venueName: event.venue.name,
          dateLabel: firstSession ? formatJalaliDate(firstSession.startAt) : "",
          sortKey: firstSession?.startAt ?? "",
          price: fromPrice(event.id),
          going: getEventEngagement(event.id).going,
          tags: event.tags,
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
  withKey.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
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
