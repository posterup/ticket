import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { formatJalaliDate, formatTime, formatNumber } from "@/lib/format";
import { MODE_LABELS } from "@/lib/events/labels";
import { groupEventsByMonth } from "@/lib/events/timeline";
import { EventStatusBadge } from "@/components/dashboard/EventStatusBadge";
import type { Event } from "@/types";

/** Events as cards laid out on a month-grouped vertical timeline. */
export function EventsTimeline({ events }: { events: Event[] }) {
  if (events.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted">
        هنوز رویدادی ندارید.
      </p>
    );
  }

  const groups = groupEventsByMonth(events);

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <section key={group.key}>
          {/* Timeline section header */}
          <div className="mb-3 flex items-center gap-2">
            <span className="size-2 rounded-full bg-accent" aria-hidden />
            <h2 className="text-sm font-semibold text-foreground">
              {group.label}
            </h2>
            <span className="text-xs text-muted">
              ({formatNumber(group.items.length)} رویداد)
            </span>
          </div>

          {/* Events on the rail */}
          <ol className="relative ms-1 flex flex-col gap-3 border-s border-border ps-5">
            {group.items.map(({ event, start }) => (
              <li key={event.id} className="relative">
                <span
                  className="absolute -start-[1.4rem] top-4 size-2.5 rounded-full border-2 border-background bg-border-strong"
                  aria-hidden
                />
                <EventCard event={event} start={start} />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function EventCard({ event, start }: { event: Event; start: string }) {
  const online = Boolean(event.venue.onlineUrl);
  const place = online
    ? "آنلاین"
    : [event.venue.name, event.venue.city].filter(Boolean).join("، ");

  return (
    <Link
      href={`/dashboard/events/${event.id}`}
      className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-border-strong hover:bg-subtle"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">
              {event.title}
            </p>
            <EventStatusBadge status={event.status} />
          </div>
          <p className="mt-1 text-xs text-muted">
            {formatJalaliDate(start)} · {formatTime(start)}
          </p>
          <p className="mt-1 truncate text-xs text-muted">
            {MODE_LABELS[event.mode]} · {place} ·{" "}
            {formatNumber(event.venue.capacity)} نفر
          </p>
        </div>
        <ChevronLeft className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden />
      </div>
    </Link>
  );
}
