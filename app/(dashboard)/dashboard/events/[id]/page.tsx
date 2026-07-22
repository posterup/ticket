import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";

import {
  getEventById,
  listTickets,
  listDiscounts,
  listCampaigns,
  listSegments,
  listCheckedHolderIds,
  listWorkspaces,
  getWorkspaceByEvent,
} from "@/lib/server";
import { buildHolders } from "@/lib/checkin/data";
import { formatJalaliDate, formatTime, formatNumber } from "@/lib/format";
import { MODE_LABELS } from "@/lib/events/labels";
import { FREQUENCY_LABELS, WEEKDAY_LABELS } from "@/lib/wizard/labels";
import { EditEventForm } from "@/components/dashboard/EditEventForm";
import { EditVenueForm } from "@/components/dashboard/EditVenueForm";
import { EventLinkForm } from "@/components/dashboard/EventLinkForm";
import { EventCollaborators } from "@/components/dashboard/EventCollaborators";
import { SessionsManager } from "@/components/dashboard/SessionsManager";
import { EventTickets } from "@/components/dashboard/EventTickets";
import { EventAccessSettings } from "@/components/dashboard/EventAccessSettings";
import { GuestInvite } from "@/components/dashboard/GuestInvite";
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

  // Workspaces a host can request to collaborate with (excluding the owner).
  const owner = getWorkspaceByEvent(event.id);
  const collabWorkspaces = listWorkspaces()
    .filter((w) => w.slug !== owner?.slug)
    .map((w) => ({ slug: w.slug, name: w.name, avatar: w.avatar }));

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
    {
      id: event.id,
      title: event.title,
      sessions: sessionOptions,
      holders: buildHolders(event.id, 0, sessionOptions),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Desktop-only: on mobile the shell's back bar provides the single back. */}
      <Link
        href="/dashboard/events"
        className="hidden items-center gap-1 text-sm text-muted hover:text-foreground lg:inline-flex"
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
              <div className="flex flex-col gap-4">
                <EventLinkForm slug={event.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <EditVenueForm eventId={event.id} venue={event.venue} />

                  <SessionsManager
                    eventId={event.id}
                    sessions={event.sessions}
                    modeLabel={MODE_LABELS[event.mode]}
                    recurrence={recurrence}
                  />
                </div>

                <EventCollaborators workspaces={collabWorkspaces} />
              </div>
            ),
          },
          {
            id: "checkin",
            label: "پذیرش و مهمانان",
            content: (
              <div className="flex flex-col gap-6">
                <GuestInvite />
                <CheckinPanel
                  events={checkinEvents}
                  initialChecked={listCheckedHolderIds()}
                />
              </div>
            ),
          },
          {
            id: "tickets",
            label: "بلیت‌ها",
            content: (
              <div className="flex flex-col gap-8">
                <EventAccessSettings />
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
            id: "marketing",
            label: "بازاریابی",
            content: (
              <MarketingPanel seedCampaigns={campaigns} segments={segments} />
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
        ]}
      />
    </div>
  );
}
