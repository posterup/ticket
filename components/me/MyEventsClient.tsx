"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  MapPin,
  Star,
  Check,
  Compass,
  Users,
  BadgeCheck,
} from "lucide-react";

import { getRsvps, type RsvpMap, type RsvpState } from "@/lib/rsvp";
import { getFollowedSlugs } from "@/lib/follow";
import { formatNumber } from "@/lib/format";

export interface MeEvent {
  id: string;
  title: string;
  city: string;
  venueName: string;
  dateLabel: string;
  price: string | null;
  org: { name: string; avatar: string; verified: boolean } | null;
}

export function MyEventsClient({ events }: { events: MeEvent[] }) {
  const [rsvps, setRsvps] = useState<RsvpMap | null>(null);
  const [followCount, setFollowCount] = useState(0);

  useEffect(() => {
    setRsvps(getRsvps());
    setFollowCount(getFollowedSlugs().length);
  }, []);

  if (rsvps === null) {
    return <p className="text-sm text-muted">در حال بارگذاری…</p>;
  }

  const byId = new Map(events.map((e) => [e.id, e]));
  const pick = (state: RsvpState) =>
    Object.keys(rsvps)
      .filter((id) => rsvps[id] === state)
      .map((id) => byId.get(id))
      .filter((e): e is MeEvent => Boolean(e));

  const going = pick("going");
  const interested = pick("interested");
  const empty = going.length === 0 && interested.length === 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/pages"
          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-border-strong"
        >
          <span className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-md bg-subtle text-foreground">
              <Users className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-medium text-foreground">
                صفحه‌ها
              </span>
              <span className="block text-xs text-muted">
                {formatNumber(followCount)} صفحه دنبال می‌کنید
              </span>
            </span>
          </span>
        </Link>
        <Link
          href="/events"
          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-border-strong"
        >
          <span className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-md bg-subtle text-foreground">
              <Compass className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-medium text-foreground">
                کشف رویدادها
              </span>
              <span className="block text-xs text-muted">
                رویدادهای تازه را ببینید
              </span>
            </span>
          </span>
        </Link>
      </div>

      {empty ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-sm font-medium text-foreground">
            هنوز رویدادی را نشان نکرده‌اید.
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            روی رویدادها «می‌روم» یا «علاقه‌مندم» را بزنید تا اینجا جمع شوند.
          </p>
          <Link
            href="/events"
            className="mt-4 inline-block text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            کشف رویدادها
          </Link>
        </div>
      ) : (
        <>
          {going.length > 0 ? (
            <Group
              title="می‌روم"
              icon={<Check className="size-4 text-foreground" aria-hidden />}
              events={going}
            />
          ) : null}
          {interested.length > 0 ? (
            <Group
              title="علاقه‌مندم"
              icon={<Star className="size-4 text-foreground" aria-hidden />}
              events={interested}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function Group({
  title,
  icon,
  events,
}: {
  title: string;
  icon: React.ReactNode;
  events: MeEvent[];
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon}
        {title}
        <span className="text-muted">({formatNumber(events.length)})</span>
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((e) => (
          <Link
            key={e.id}
            href={`/events/${e.id}`}
            className="flex flex-col rounded-lg border border-border bg-card p-5 transition-colors hover:border-border-strong"
          >
            {e.org ? (
              <span className="mb-3 flex items-center gap-2 text-xs text-muted">
                <span className="grid size-6 place-items-center rounded-full bg-foreground text-[0.625rem] font-bold text-background">
                  {e.org.avatar}
                </span>
                <span className="flex items-center gap-1 truncate">
                  {e.org.name}
                  {e.org.verified ? (
                    <BadgeCheck className="size-3.5 shrink-0 text-accent" aria-label="تأییدشده" />
                  ) : null}
                </span>
              </span>
            ) : null}
            <h3 className="text-base font-semibold text-foreground">{e.title}</h3>
            <div className="mt-3 flex flex-col gap-2 text-sm text-muted">
              {e.dateLabel ? (
                <span className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-faint" aria-hidden />
                  {e.dateLabel}
                </span>
              ) : null}
              <span className="flex items-center gap-2">
                <MapPin className="size-4 text-faint" aria-hidden />
                {e.venueName}، {e.city}
              </span>
            </div>
            {e.price ? (
              <span className="mt-4 border-t border-border pt-3 text-sm font-medium text-foreground">
                {e.price}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
