/** Ticket-type data-access over Postgres. */

import type { CreateTicketTypeInput, TicketType } from "@/types";

import { db } from "./db";
import { toTicketType } from "./mappers";
import { TICKET_CATEGORY_TO_DB } from "./mappers/enums";

/** Return ticket types, optionally scoped to a single event. */
export async function listTickets(eventId?: string): Promise<TicketType[]> {
  const rows = await db.ticketType.findMany({
    where: eventId ? { eventId } : undefined,
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toTicketType);
}

/**
 * Ticket types for many events at once, keyed by event id.
 *
 * Batched so listing pages resolve prices in one query instead of calling
 * {@link listTickets} inside a `.map()`.
 */
export async function listTicketsForEvents(
  eventIds: string[],
): Promise<Map<string, TicketType[]>> {
  const out = new Map<string, TicketType[]>(eventIds.map((id) => [id, []]));
  if (eventIds.length === 0) return out;

  const rows = await db.ticketType.findMany({
    where: { eventId: { in: eventIds } },
    orderBy: { createdAt: "asc" },
  });
  for (const row of rows) {
    out.get(row.eventId)?.push(toTicketType(row));
  }
  return out;
}

/**
 * Cheapest ticket price per event ("from X Toman"), keyed by event id. Events
 * with no ticket types are absent from the map.
 */
export async function minPriceByEvent(
  eventIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (eventIds.length === 0) return out;

  const grouped = await db.ticketType.groupBy({
    by: ["eventId"],
    where: { eventId: { in: eventIds } },
    _min: { price: true },
  });
  for (const g of grouped) {
    if (g._min.price !== null) out.set(g.eventId, g._min.price);
  }
  return out;
}

/** Create and persist a new ticket type, returning the stored record. */
export async function createTicketType(
  input: CreateTicketTypeInput,
): Promise<TicketType> {
  const row = await db.ticketType.create({
    data: {
      eventId: input.eventId,
      name: input.name,
      price: input.price,
      capacity: input.capacity,
      salesStartAt: new Date(input.salesStartAt),
      salesEndAt: new Date(input.salesEndAt),
      category: TICKET_CATEGORY_TO_DB[input.category],
      description: input.description,
    },
  });
  return toTicketType(row);
}

/** Fields an organizer may edit on an existing ticket type. */
export type TicketTypeUpdate = Partial<
  Pick<
    TicketType,
    | "name"
    | "price"
    | "capacity"
    | "salesStartAt"
    | "salesEndAt"
    | "category"
    | "description"
  >
>;

/**
 * Update a ticket type. Returns the record, or `undefined` when no ticket type
 * has the given id.
 */
export async function updateTicketType(
  id: string,
  patch: TicketTypeUpdate,
): Promise<TicketType | undefined> {
  const exists = await db.ticketType.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) return undefined;

  const row = await db.ticketType.update({
    where: { id },
    data: {
      name: patch.name,
      price: patch.price,
      capacity: patch.capacity,
      salesStartAt: patch.salesStartAt ? new Date(patch.salesStartAt) : undefined,
      salesEndAt: patch.salesEndAt ? new Date(patch.salesEndAt) : undefined,
      category: patch.category ? TICKET_CATEGORY_TO_DB[patch.category] : undefined,
      // An empty description clears it, as before.
      description: patch.description === undefined ? undefined : patch.description || null,
    },
  });
  return toTicketType(row);
}
