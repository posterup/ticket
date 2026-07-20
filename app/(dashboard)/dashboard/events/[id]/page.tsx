import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, MapPin } from "lucide-react";

import { getEventById, listTickets, listDiscounts } from "@/lib/server";
import { formatJalaliDate, formatTime, formatNumber } from "@/lib/format";
import { MODE_LABELS } from "@/lib/events/labels";
import { FREQUENCY_LABELS, WEEKDAY_LABELS } from "@/lib/wizard/labels";
import { EditEventForm } from "@/components/dashboard/EditEventForm";
import { SessionsManager } from "@/components/dashboard/SessionsManager";
import { EventTickets } from "@/components/dashboard/EventTickets";
import { EventDiscounts } from "@/components/dashboard/EventDiscounts";
import type { Event } from "@/types";

interface Params {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const event = getEventById(id);
  return { title: event ? `${event.title} | پوستر` : "رویداد | پوستر" };
}

function recurrenceText(event: Event): string | null {
  if (!event.recurrence) return null;
  const { frequency, interval, byDay } = event.recurrence;
  const base =
    interval > 1
      ? `هر ${formatNumber(interval)} بار، ${FREQUENCY_LABELS[frequency]}`
      : FREQUENCY_LABELS[frequency];
  if (byDay && byDay.length > 0) {
    return `${base} · ${byDay.map((d) => WEEKDAY_LABELS[d]).join("، ")}`;
  }
  return base;
}

export default async function EventDetailPage({ params }: Params) {
  const { id } = await params;
  const event = getEventById(id);
  if (!event) notFound();
  const tickets = listTickets(id);
  const discounts = listDiscounts(id);
  const recurrence = recurrenceText(event);
  const sessionOptions = event.sessions.map((s) => ({
    id: s.id,
    label: `${formatJalaliDate(s.startAt)} · ${formatTime(s.startAt)}`,
  }));

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/events"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ChevronRight className="size-4" aria-hidden />
        بازگشت به رویدادها
      </Link>

      <EditEventForm
        eventId={event.id}
        title={event.title}
        description={event.description}
        status={event.status}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-border p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <MapPin className="size-4 text-faint" aria-hidden />
            محل برگزاری
          </h2>
          <p className="text-sm text-foreground">{event.venue.name}</p>
          <p className="mt-1 text-sm text-muted">{event.venue.address}</p>
          <p className="mt-1 text-sm text-muted">
            {[event.venue.province, event.venue.city].filter(Boolean).join("، ")} · ظرفیت{" "}
            {formatNumber(event.venue.capacity)} نفر
          </p>
        </section>

        <SessionsManager
          eventId={event.id}
          sessions={event.sessions}
          modeLabel={MODE_LABELS[event.mode]}
          recurrence={recurrence}
        />
      </div>

      <EventTickets eventId={event.id} tickets={tickets} />

      <EventDiscounts
        eventId={event.id}
        sessions={sessionOptions}
        discounts={discounts}
      />
    </div>
  );
}
