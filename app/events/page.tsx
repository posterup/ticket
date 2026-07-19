import type { Metadata } from "next";

import {
  listEvents,
  listTickets,
  getWorkspaceByEvent,
} from "@/lib/server";
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

export default function PublicEventsPage() {
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

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            رویدادها
          </h1>
          <p className="mt-2 text-sm text-muted">
            تجربه‌ها و رویدادهای جذاب اطرافتان را کشف کنید.
          </p>
        </div>
        <EventsExplorer events={events} />
      </main>
      <Footer />
    </div>
  );
}
