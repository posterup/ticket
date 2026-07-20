import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, MapPin } from "lucide-react";

import {
  getEventById,
  listTickets,
  listDiscounts,
  listCampaigns,
  listSegments,
} from "@/lib/server";
import { buildHolders } from "@/lib/checkin/data";
import { formatJalaliDate, formatTime, formatNumber } from "@/lib/format";
import { MODE_LABELS } from "@/lib/events/labels";
import { FREQUENCY_LABELS, WEEKDAY_LABELS } from "@/lib/wizard/labels";
import { EditEventForm } from "@/components/dashboard/EditEventForm";
import { SessionsManager } from "@/components/dashboard/SessionsManager";
import { EventTickets } from "@/components/dashboard/EventTickets";
import { EventDiscounts } from "@/components/dashboard/EventDiscounts";
import { EventConsole } from "@/components/dashboard/EventConsole";
import { TicketDesigner } from "@/components/tickets/TicketDesigner";
import { MarketingPanel } from "@/components/marketing/MarketingPanel";
import { CheckinPanel } from "@/components/checkin/CheckinPanel";
import type { TicketSample } from "@/components/tickets/TicketPreview";
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
  const campaigns = listCampaigns();
  const segments = listSegments();
  const recurrence = recurrenceText(event);
  const sessionOptions = event.sessions.map((s) => ({
    id: s.id,
    label: `${formatJalaliDate(s.startAt)} · ${formatTime(s.startAt)}`,
  }));

  const first = event.sessions[0];
  const ticketSample: TicketSample = {
    eventTitle: event.title,
    holder: "سارا محمدی",
    category: tickets[0]?.name ?? "عمومی",
    seat: "ردیف A · صندلی ۱۲",
    date: first
      ? `${formatJalaliDate(first.startAt)} · ${formatTime(first.startAt)}`
      : "تاریخ رویداد",
    venue: [event.venue.name, event.venue.city].filter(Boolean).join("، "),
  };

  const checkinEvents = [
    { id: event.id, title: event.title, holders: buildHolders(event.id, 0) },
  ];

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

      <EventConsole
        tabs={[
          {
            id: "overview",
            label: "نمای کلی",
            content: (
              <div className="grid gap-4 sm:grid-cols-2">
                <section className="rounded-lg border border-border p-5">
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <MapPin className="size-4 text-faint" aria-hidden />
                    محل برگزاری
                  </h2>
                  <p className="text-sm text-foreground">{event.venue.name}</p>
                  <p className="mt-1 text-sm text-muted">{event.venue.address}</p>
                  <p className="mt-1 text-sm text-muted">
                    {[event.venue.province, event.venue.city]
                      .filter(Boolean)
                      .join("، ")}{" "}
                    · ظرفیت {formatNumber(event.venue.capacity)} نفر
                  </p>
                </section>

                <SessionsManager
                  eventId={event.id}
                  sessions={event.sessions}
                  modeLabel={MODE_LABELS[event.mode]}
                  recurrence={recurrence}
                />
              </div>
            ),
          },
          {
            id: "tickets",
            label: "بلیت‌ها",
            content: (
              <div className="flex flex-col gap-8">
                <EventTickets
                  eventId={event.id}
                  tickets={tickets}
                  sessions={sessionOptions}
                />
                <section className="flex flex-col gap-4 border-t border-border pt-6">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      قالب بلیت
                    </h2>
                    <p className="mt-1 text-xs text-muted">
                      ظاهر بلیت صادرشدهٔ این رویداد را سفارشی کنید و پیش‌نمایش را
                      ببینید.
                    </p>
                  </div>
                  <TicketDesigner sample={ticketSample} />
                </section>
              </div>
            ),
          },
          {
            id: "discounts",
            label: "تخفیف‌ها",
            content: (
              <EventDiscounts
                eventId={event.id}
                sessions={sessionOptions}
                discounts={discounts}
              />
            ),
          },
          {
            id: "marketing",
            label: "بازاریابی",
            content: (
              <MarketingPanel seedCampaigns={campaigns} segments={segments} />
            ),
          },
          {
            id: "checkin",
            label: "پذیرش و مهمانان",
            content: <CheckinPanel events={checkinEvents} />,
          },
        ]}
      />
    </div>
  );
}
