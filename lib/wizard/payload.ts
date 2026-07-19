import type { CreateEventInput, CreateTicketTypeInput } from "@/types";

import type { WizardState, TicketTypeForm } from "./types";

/** Combine a `YYYY-MM-DD` date and `HH:MM` time into an ISO 8601 string. */
export function toIso(date: string, time: string): string {
  return new Date(`${date}T${time || "00:00"}`).toISOString();
}

function toInt(value: string): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

/** Build the `POST /api/events` payload from wizard state. */
export function buildEventPayload(state: WizardState): CreateEventInput {
  const { event, mode, oneTime, recurring } = state;

  const session =
    mode === "one-time"
      ? {
          startAt: toIso(oneTime.date, oneTime.startTime),
          endAt: toIso(oneTime.date, oneTime.endTime),
        }
      : {
          startAt: toIso(recurring.date, recurring.startTime),
          endAt: toIso(recurring.date, recurring.endTime),
        };

  return {
    title: event.title.trim(),
    description: event.description.trim(),
    mode,
    venue: {
      name: event.venue.name.trim(),
      city: event.venue.city.trim(),
      address: event.venue.address.trim(),
      capacity: toInt(event.venue.capacity),
    },
    sessions: [session],
    recurrence:
      mode === "recurring"
        ? {
            frequency: recurring.frequency,
            interval: Math.max(1, toInt(recurring.interval)),
            byDay:
              recurring.frequency === "weekly" && recurring.byDay.length > 0
                ? recurring.byDay
                : undefined,
            until: recurring.until
              ? toIso(recurring.until, "23:59")
              : undefined,
          }
        : undefined,
    tags: [],
    status: "draft",
  };
}

/** Build one `POST /api/tickets` payload per ticket type, scoped to `eventId`. */
export function buildTicketPayloads(
  ticketTypes: TicketTypeForm[],
  eventId: string,
): CreateTicketTypeInput[] {
  return ticketTypes.map((t) => ({
    eventId,
    name: t.name.trim(),
    price: toInt(t.price),
    capacity: toInt(t.capacity),
    salesStartAt: toIso(t.salesStartDate, "00:00"),
    salesEndAt: toIso(t.salesEndDate, "23:59"),
    category: t.category,
    description: t.description.trim() || undefined,
  }));
}
