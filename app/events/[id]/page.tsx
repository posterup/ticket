import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Clock, Repeat, ChevronLeft } from "lucide-react";

import {
  getEventById,
  listTickets,
  getWorkspaceByEvent,
  getEventEngagement,
} from "@/lib/server";
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
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import { EventRsvp } from "@/components/events/EventRsvp";
import { EventCover } from "@/components/events/EventCover";
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
  return byDay && byDay.length > 0
    ? `${base} · ${byDay.map((d) => WEEKDAY_LABELS[d]).join("، ")}`
    : base;
}

export default async function PublicEventDetail({ params }: Params) {
  const { id } = await params;
  const event = getEventById(id);
  if (!event) notFound();
  const tickets = listTickets(id);
  const recurrence = recurrenceText(event);
  const organizer = getWorkspaceByEvent(id);
  const engagement = getEventEngagement(id);

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
        <Link
          href="/events"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ChevronLeft className="size-4 rotate-180" aria-hidden />
          همه رویدادها
        </Link>

        <EventCover
          seed={event.id}
          tags={event.tags}
          className="mt-4 aspect-[16/6] rounded-xl"
        />

        <div className="mt-6">
          <span className="text-xs text-faint">{MODE_LABELS[event.mode]}</span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {event.title}
          </h1>
          {event.description ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
              {event.description}
            </p>
          ) : null}
          {organizer ? (
            <p className="mt-3 text-sm text-muted">
              برگزارکننده:{" "}
              <Link
                href={`/w/${organizer.slug}`}
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                {organizer.name}
              </Link>
            </p>
          ) : null}
        </div>

        <div className="mt-5">
          <EventRsvp
            eventId={event.id}
            baseGoing={engagement.going}
            baseInterested={engagement.interested}
          />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Clock className="size-4 text-faint" aria-hidden />
              زمان
            </h2>
            <ul className="flex flex-col gap-2 text-sm text-muted">
              {event.sessions.map((s) => (
                <li key={s.id}>
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
          </div>

          <div className="rounded-lg border border-border p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <MapPin className="size-4 text-faint" aria-hidden />
              مکان
            </h2>
            {event.venue.name ? (
              <p className="text-sm text-foreground">{event.venue.name}</p>
            ) : null}
            <p
              className={cn(
                "text-sm text-muted",
                event.venue.name ? "mt-1" : undefined,
              )}
            >
              {[event.venue.province, event.venue.city].filter(Boolean).join("، ")}
            </p>
            {event.venue.hideAddress ? (
              <p className="mt-1 text-xs text-faint">
                آدرس دقیق و موقعیت روی نقشه برای این رویداد نمایش داده نمی‌شود.
              </p>
            ) : event.venue.address ? (
              <p className="mt-1 text-sm text-muted">{event.venue.address}</p>
            ) : null}
          </div>
        </div>

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            انتخاب بلیت
          </h2>
          {tickets.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
              فروش بلیت برای این رویداد هنوز آغاز نشده است.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {tickets.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-col gap-4 rounded-lg border border-border p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {t.name}
                      </p>
                      <span className="rounded-full border border-border bg-subtle px-2 py-0.5 text-xs text-muted">
                        {CATEGORY_LABELS[t.category]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      ظرفیت {formatNumber(t.capacity)} · فروش تا{" "}
                      {formatJalaliDate(t.salesEndAt)}
                    </p>
                    {t.description ? (
                      <p className="mt-1 text-xs text-muted">{t.description}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                    <span className="text-sm font-semibold text-foreground">
                      {formatToman(t.price)}
                    </span>
                    <Link
                      href={`/events/${event.id}/checkout?ticket=${t.id}`}
                      className={cn(
                        buttonVariants({ variant: "primary", size: "sm" }),
                      )}
                    >
                      تهیه بلیت
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
