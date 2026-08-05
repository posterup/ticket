"use client";

import { use } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { useApi } from "@/lib/client/api";
import { AsyncState } from "@/components/ui/async-state";
import { formatJalaliDate, formatTime, venueParts } from "@/lib/format";
import { modeLabel } from "@/lib/events/labels";
import { CALENDAR_MODE_ENABLED } from "@/lib/flags";
import { EditEventForm } from "@/components/dashboard/EditEventForm";
import { EditVenueForm } from "@/components/dashboard/EditVenueForm";
import { EventLinkForm } from "@/components/dashboard/EventLinkForm";
import { EventCollaborators } from "@/components/dashboard/EventCollaborators";
import { SessionsManager } from "@/components/dashboard/SessionsManager";
import { EventTickets } from "@/components/dashboard/EventTickets";
import { EventSeatMap } from "@/components/dashboard/EventSeatMap";
import { EventAccessSettings } from "@/components/dashboard/EventAccessSettings";
import { RecurrenceEditor } from "@/components/dashboard/RecurrenceEditor";
import { AttendanceManager } from "@/components/dashboard/AttendanceManager";
import { ApprovalList } from "@/components/dashboard/ApprovalList";
import { EventWaitlist } from "@/components/dashboard/EventWaitlist";
import { EventRefunds } from "@/components/dashboard/EventRefunds";
import { EventDiscounts } from "@/components/dashboard/EventDiscounts";
import { EventConsole } from "@/components/dashboard/EventConsole";
import { TicketDesigner } from "@/components/tickets/TicketDesigner";
import type { TicketSample } from "@/components/tickets/TicketPreview";
import { emptySlot, type ScheduleDraft } from "@/lib/create/types";
import type {
  DiscountCode,
  Event,
  EventCollaborator,
  EventGuest,
  EventRegistration,
  TicketType,
} from "@/types";
import type { Holder } from "@/lib/server/checkins";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * Build the create-composer schedule draft for a recurring event, from its
 * stored {@link RecurrenceSchedule} or (legacy) derived from its sessions.
 */
function buildScheduleDraft(event: Event): ScheduleDraft {
  const rs = event.recurrenceSchedule;
  const toSlot = (s: { id: string; startTime: string; endTime: string }) => ({
    id: s.id,
    date: "",
    startTime: s.startTime,
    endTime: s.endTime,
  });
  if (rs) {
    return {
      calendar: true,
      startDate: rs.startDate,
      endDate: rs.endDate,
      byDay: rs.byDay,
      slots: rs.slots.length > 0 ? rs.slots.map(toSlot) : [emptySlot("slot-1")],
      daySlots: Object.fromEntries(
        Object.entries(rs.daySlots ?? {}).map(([d, arr]) => [
          d,
          (arr ?? []).map(toSlot),
        ]),
      ),
      exceptions: rs.exceptions,
    };
  }
  // Legacy recurring events: derive the schedule from concrete sessions.
  const dates = [
    // The venue's day, not UTC's: a سانس at 00:30 Tehran is the *previous*
    // date in UTC, and slicing it here moved the whole schedule back a day.
    ...new Set(event.sessions.map((s) => venueParts(s.startAt).date)),
  ].sort();
  const seen = new Map<string, { id: string; startTime: string; endTime: string }>();
  for (const s of event.sessions) {
    // This draft is what `applySchedule` writes back. Slicing UTC here and
    // saving venue-local there shifted every سانس by the offset on each save.
    const startTime = venueParts(s.startAt).time;
    const endTime = venueParts(s.endAt).time;
    const key = `${startTime}-${endTime}`;
    if (!seen.has(key)) {
      seen.set(key, { id: `slot-${seen.size + 1}`, startTime, endTime });
    }
  }
  const slots = [...seen.values()].map(toSlot);
  return {
    calendar: true,
    startDate: dates[0] ?? "",
    endDate: dates[dates.length - 1] ?? "",
    byDay: event.recurrence?.byDay ?? [],
    slots: slots.length > 0 ? slots : [emptySlot("slot-1")],
    daySlots: {},
    exceptions: [],
  };
}

interface DashboardData {
  event: Event;
  sessions: { id: string; label: string }[];
  tickets: TicketType[];
  discounts: DiscountCode[];
  guests: EventGuest[];
  collaborators: EventCollaborator[];
  registrations: EventRegistration[];
  holders: Holder[];
  checked: string[];
  audienceTags: { label: string; count: number }[];
  collabWorkspaces: { slug: string; name: string; avatar: string }[];
}

export default function EventDetailPage({ params }: Params) {
  const { id } = use(params);
  const { data, error, loading, reload } = useApi<DashboardData>(
    `/api/events/${id}/dashboard`,
  );

  if (!data) {
    return <AsyncState loading={loading} error={error} onRetry={reload} />;
  }

  const {
    event,
    tickets,
    discounts,
    collaborators,
    registrations,
    holders,
    audienceTags,
    collabWorkspaces,
  } = data;
  const sessionOptions = data.sessions;
  const checkedHolderIds = data.checked;
  const guests = data.guests;
  // A free event (all ticket types priced at 0) has nothing to price or
  // discount, so its «بلیت‌ها» and «تخفیف‌ها» tabs are hidden.
  const isFree = tickets.length > 0 && tickets.every((t) => t.price === 0);

  const first = event.sessions[0];
  const ticketSample: TicketSample = {
    eventTitle: event.title,
    holder: "سارا محمدی",
    category: tickets[0]?.name ?? "عمومی",
    date: first
      ? `${formatJalaliDate(first.startAt)} · ${formatTime(first.startAt)}`
      : "تاریخ رویداد",
    venue: [event.venue.name, event.venue.city].filter(Boolean).join("، "),
  };


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

      <div className="hidden lg:block">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {event.title}
        </h1>
        {event.description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {event.description}
          </p>
        ) : null}
      </div>

      <EventConsole
        tabs={[
          {
            id: "overview",
            label: "نمای کلی",
            content: (
              <div className="flex flex-col gap-4">
                <EditEventForm
                  eventId={event.id}
                  title={event.title}
                  description={event.description}
                />
                {CALENDAR_MODE_ENABLED && event.mode === "recurring" ? (
                  <>
                    <EditVenueForm eventId={event.id} venue={event.venue} />
                    <RecurrenceEditor
                      eventId={event.id}
                      schedule={buildScheduleDraft(event)}
                    />
                  </>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <EditVenueForm eventId={event.id} venue={event.venue} />

                    <SessionsManager
                      eventId={event.id}
                      sessions={event.sessions}
                      modeLabel={modeLabel(event.mode)}
                      hideStatus={isFree}
                    />
                  </div>
                )}

                <EventCollaborators
                  eventId={event.id}
                  workspaces={collabWorkspaces}
                  initial={collaborators}
                />

                <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
                  <div className="p-5">
                    <EventAccessSettings
                      eventId={event.id}
                      visibility={event.visibility}
                      requiresApproval={event.requiresApproval}
                      audienceTags={event.audienceTags}
                      availableTags={audienceTags}
                    />
                  </div>
                  <div className="p-5">
                    <EventLinkForm
                      eventId={event.id}
                      slug={event.slug ?? event.id}
                    />
                  </div>
                </div>
              </div>
            ),
          },
          {
            id: "checkin",
            label: "پذیرش و مهمانان",
            content: (
              <AttendanceManager
                eventId={event.id}
                eventTitle={event.title}
                sessions={sessionOptions}
                holders={holders}
                capacity={event.venue.capacity}
                guests={guests}
                initialChecked={checkedHolderIds}
                allowGuests={event.mode !== "recurring"}
                onlyGuests={isFree}
              />
            ),
          },
          // Invite-only events review registration requests in their own tab.
          ...(event.requiresApproval
            ? [
                {
                  id: "registrations",
                  label: "درخواست‌های ثبت‌نام",
                  content: (
                    <ApprovalList
                      eventId={event.id}
                      registrations={registrations}
                    />
                  ),
                },
              ]
            : []),
          // Same shape as approvals: only shown when the organiser turned the
          // feature on, so the console stays as short as the event is simple.
          ...(event.waitlist
            ? [
                {
                  id: "waitlist",
                  label: "لیست انتظار",
                  content: <EventWaitlist eventId={event.id} />,
                },
              ]
            : []),
          // Only for events that took money. A free event has nothing to
          // refund, and a paid one that has sold nothing shows an empty state
          // rather than a tab that appears and disappears as orders land.
          ...(isFree
            ? []
            : [
                {
                  id: "refunds",
                  label: "بازپرداخت",
                  content: <EventRefunds eventId={event.id} />,
                },
              ]),
          // Free events have no tickets to price/design and nothing to
          // discount, so both tabs are hidden entirely.
          ...(isFree
            ? []
            : [
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
                      {/* Seat maps price themselves off the ticket types above,
                          so this belongs after them, not on its own tab. */}
                      <EventSeatMap
                        eventId={event.id}
                        sessions={event.sessions}
                        tickets={tickets}
                      />
                      <section className="flex flex-col gap-4 border-t border-border pt-6">
                        <div>
                          <h2 className="text-sm font-semibold text-foreground">
                            قالب بلیت
                          </h2>
                          <p className="mt-1 text-xs text-muted">
                            ظاهر بلیت صادرشدهٔ این رویداد را سفارشی کنید و
                            پیش‌نمایش را ببینید.
                          </p>
                        </div>
                        <TicketDesigner
                          sample={ticketSample}
                          eventId={event.id}
                          initial={event.ticketDesign}
                        />
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
              ]),
        ]}
      />
    </div>
  );
}
