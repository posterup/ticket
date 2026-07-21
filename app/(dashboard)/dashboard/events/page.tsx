import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { listEvents } from "@/lib/server";
import { formatNumber } from "@/lib/format";
import { MODE_LABELS } from "@/lib/events/labels";
import { EventStatusBadge } from "@/components/dashboard/EventStatusBadge";

export const metadata: Metadata = { title: "رویدادها | پوستر" };

export default function EventsPage() {
  const events = listEvents();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          رویدادها
        </h1>
        <p className="mt-1 text-sm text-muted">
          مدیریت رویدادها، جلسات و انواع بلیت.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <ul className="divide-y divide-border">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/dashboard/events/${event.id}`}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-subtle"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {event.title}
                    </p>
                    <EventStatusBadge status={event.status} />
                  </div>
                  <p className="mt-1 truncate text-xs text-muted">
                    {MODE_LABELS[event.mode]} · {event.venue.name}، {event.venue.city} ·{" "}
                    {formatNumber(event.venue.capacity)} نفر
                  </p>
                </div>
                <ChevronLeft
                  className="size-4 shrink-0 text-faint"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
