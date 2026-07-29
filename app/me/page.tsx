import type { Metadata } from "next";

import {
  listEvents,
  minPriceByEvent,
  getWorkspacesByEvents,
} from "@/lib/server";
import { formatJalaliDate, formatToman } from "@/lib/format";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import { MyEventsClient, type MeEvent } from "@/components/me/MyEventsClient";

export const metadata: Metadata = {
  title: "من | پوستر",
  description: "رویدادهایی که نشان کرده‌اید و صفحه‌هایی که دنبال می‌کنید.",
};

function fromPrice(min: number | undefined): string | null {
  if (min === undefined) return null;
  return min === 0 ? "رایگان" : `از ${formatToman(min)}`;
}

export default async function MePage() {
  const published = (await listEvents()).filter(
    (e) => e.status === "published",
  );
  const ids = published.map((e) => e.id);

  // Resolved in one batch each, rather than per row inside the map below.
  const [prices, orgs] = await Promise.all([
    minPriceByEvent(ids),
    getWorkspacesByEvents(ids),
  ]);

  const events: MeEvent[] = published.map((event) => {
    const org = orgs.get(event.id);
    const firstSession = event.sessions[0];
    return {
      id: event.id,
      title: event.title,
      city: event.venue.city,
      venueName: event.venue.name,
      dateLabel: firstSession ? formatJalaliDate(firstSession.startAt) : "",
      price: fromPrice(prices.get(event.id)),
      tags: event.tags,
      org: org
        ? { name: org.name, avatar: org.avatar, verified: Boolean(org.verified) }
        : null,
    };
  });

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
        <MyEventsClient events={events} />
      </main>
      <Footer />
    </div>
  );
}
