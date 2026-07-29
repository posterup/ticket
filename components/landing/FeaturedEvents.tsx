import Link from "next/link";
import { MapPin, CalendarDays, ArrowLeft, BadgeCheck, Users } from "lucide-react";

import {
  listEvents,
  minPriceByEvent,
  getWorkspacesByEvents,
  getEventEngagements,
} from "@/lib/server";
import { formatJalaliDate, formatToman, formatNumber } from "@/lib/format";
import { modeLabel } from "@/lib/events/labels";
import { EventCover } from "@/components/events/EventCover";

function fromPrice(min: number | undefined): string | null {
  if (min === undefined) return null;
  return min === 0 ? "رایگان" : `از ${formatToman(min)}`;
}

/**
 * Landing discovery strip: a few upcoming events, each tied to the organizer
 * page that owns it — so the front door shows the social platform in action
 * rather than only describing it.
 */
export async function FeaturedEvents() {
  const events = (await listEvents())
    .filter((e) => e.status === "published")
    .slice(0, 3);

  if (events.length === 0) return null;

  // Resolved in one batch each, rather than per card below.
  const ids = events.map((e) => e.id);
  const [prices, orgs, engagement] = await Promise.all([
    minPriceByEvent(ids),
    getWorkspacesByEvents(ids),
    getEventEngagements(ids),
  ]);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            رویدادهای پیش‌رو
          </h2>
          <p className="mt-2 text-sm text-muted">
            تجربه‌ها و رویدادهای جذاب اطرافتان را کشف کنید.
          </p>
        </div>
        <Link
          href="/events"
          className="hidden shrink-0 items-center gap-1.5 text-sm font-medium text-muted underline-offset-4 hover:text-foreground hover:underline sm:inline-flex"
        >
          همهٔ رویدادها
          <ArrowLeft className="size-4" aria-hidden />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => {
          const price = fromPrice(prices.get(event.id));
          const firstSession = event.sessions[0];
          const organizer = orgs.get(event.id);
          const going = engagement.get(event.id)?.going ?? 0;
          return (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-border-strong"
            >
              <EventCover seed={event.id} tags={event.tags} className="aspect-video" />
              <div className="flex flex-1 flex-col p-5">
              {organizer ? (
                <span className="mb-3 flex items-center gap-2 text-xs text-muted">
                  <span className="grid size-6 place-items-center rounded-full bg-foreground text-[0.625rem] font-bold text-background">
                    {organizer.avatar}
                  </span>
                  <span className="flex items-center gap-1 truncate">
                    {organizer.name}
                    {organizer.verified ? (
                      <BadgeCheck
                        className="size-3.5 shrink-0 text-accent"
                        aria-label="تأییدشده"
                      />
                    ) : null}
                  </span>
                </span>
              ) : null}
              {modeLabel(event.mode) ? (
                <span className="text-xs text-faint">{modeLabel(event.mode)}</span>
              ) : null}
              <h3 className="mt-1 text-base font-semibold text-foreground">
                {event.title}
              </h3>
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
                {going > 0 ? (
                  <span className="flex items-center gap-2">
                    <Users className="size-4 text-faint" aria-hidden />
                    {formatNumber(going)} نفر می‌روند
                  </span>
                ) : null}
              </div>
              {price ? (
                <span className="mt-auto border-t border-border pt-3 text-sm font-medium text-foreground">
                  {price}
                </span>
              ) : null}
              </div>
            </Link>
          );
        })}
      </div>

      <Link
        href="/events"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted underline-offset-4 hover:text-foreground hover:underline sm:hidden"
      >
        همهٔ رویدادها
        <ArrowLeft className="size-4" aria-hidden />
      </Link>
    </section>
  );
}
