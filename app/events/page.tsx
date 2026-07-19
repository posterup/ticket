import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, CalendarDays } from "lucide-react";

import { listEvents, listTickets } from "@/lib/server";
import { formatJalaliDate, formatToman } from "@/lib/format";
import { MODE_LABELS } from "@/lib/events/labels";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";

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
  const events = listEvents();

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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => {
            const price = fromPrice(event.id);
            const firstSession = event.sessions[0];
            return (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="flex flex-col rounded-lg border border-border bg-card p-5 transition-colors hover:border-border-strong"
              >
                <span className="text-xs text-faint">
                  {MODE_LABELS[event.mode]}
                </span>
                <h2 className="mt-1 text-base font-semibold text-foreground">
                  {event.title}
                </h2>
                <div className="mt-4 flex flex-col gap-2 text-sm text-muted">
                  {firstSession ? (
                    <span className="flex items-center gap-2">
                      <CalendarDays className="size-4 text-faint" aria-hidden />
                      {formatJalaliDate(firstSession.startAt)}
                    </span>
                  ) : null}
                  <span className="flex items-center gap-2">
                    <MapPin className="size-4 text-faint" aria-hidden />
                    {event.venue.name}، {event.venue.city}
                  </span>
                </div>
                {price ? (
                  <span className="mt-4 border-t border-border pt-3 text-sm font-medium text-foreground">
                    {price}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </main>
      <Footer />
    </div>
  );
}
