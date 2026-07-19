import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, MapPin, Clock, Repeat, Ticket } from "lucide-react";

import { getEventById, listTickets } from "@/lib/server";
import {
  formatJalaliDate,
  formatTime,
  formatToman,
  formatNumber,
} from "@/lib/format";
import { MODE_LABELS } from "@/lib/events/labels";
import {
  CATEGORY_LABELS,
  FREQUENCY_LABELS,
  WEEKDAY_LABELS,
} from "@/lib/wizard/labels";
import { EventStatusBadge } from "@/components/dashboard/EventStatusBadge";
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
  const recurrence = recurrenceText(event);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/events"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ChevronRight className="size-4" aria-hidden />
        بازگشت به رویدادها
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {event.title}
          </h1>
          <EventStatusBadge status={event.status} />
        </div>
        {event.description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {event.description}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-border p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <MapPin className="size-4 text-faint" aria-hidden />
            محل برگزاری
          </h2>
          <p className="text-sm text-foreground">{event.venue.name}</p>
          <p className="mt-1 text-sm text-muted">{event.venue.address}</p>
          <p className="mt-1 text-sm text-muted">
            {event.venue.city} · ظرفیت {formatNumber(event.venue.capacity)} نفر
          </p>
        </section>

        <section className="rounded-lg border border-border p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock className="size-4 text-faint" aria-hidden />
            زمان‌بندی · {MODE_LABELS[event.mode]}
          </h2>
          <ul className="flex flex-col gap-2">
            {event.sessions.map((s) => (
              <li key={s.id} className="text-sm text-muted">
                {formatJalaliDate(s.startAt)} · {formatTime(s.startAt)} تا{" "}
                {formatTime(s.endAt)}
              </li>
            ))}
          </ul>
          {recurrence ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-muted">
              <Repeat className="size-3.5 text-faint" aria-hidden />
              {recurrence}
            </p>
          ) : null}
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Ticket className="size-4 text-faint" aria-hidden />
          انواع بلیت
        </h2>
        {tickets.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
            هنوز نوع بلیتی برای این رویداد تعریف نشده است.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {tickets.map((t) => (
              <div key={t.id} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {t.name}
                  </p>
                  <span className="rounded-full border border-border bg-subtle px-2 py-0.5 text-xs text-muted">
                    {CATEGORY_LABELS[t.category]}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {formatToman(t.price)}
                </p>
                <dl className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3 text-xs text-muted">
                  <div className="flex justify-between">
                    <dt>ظرفیت</dt>
                    <dd className="text-foreground">
                      {formatNumber(t.capacity)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>بازه فروش</dt>
                    <dd>
                      {formatJalaliDate(t.salesStartAt)} تا{" "}
                      {formatJalaliDate(t.salesEndAt)}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
