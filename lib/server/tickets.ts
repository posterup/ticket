/**
 * Ticket-type data-access functions over the in-memory {@link ticketTypes}
 * store. Replace the array operations with real queries when a datastore is
 * added.
 */

import type { CreateTicketTypeInput, TicketType } from "@/types";

import { ticketTypes } from "./store";

/** Return ticket types, optionally scoped to a single event. */
export async function listTickets(eventId?: string): Promise<TicketType[]> {
  if (eventId === undefined) {
    return [...ticketTypes];
  }
  return ticketTypes.filter((ticket) => ticket.eventId === eventId);
}

/**
 * Ticket types for many events at once, keyed by event id.
 *
 * Batched so listing pages resolve prices in one round trip instead of calling
 * {@link listTickets} inside a `.map()`.
 */
export async function listTicketsForEvents(
  eventIds: string[],
): Promise<Map<string, TicketType[]>> {
  const wanted = new Set(eventIds);
  const out = new Map<string, TicketType[]>(eventIds.map((id) => [id, []]));
  for (const ticket of ticketTypes) {
    if (wanted.has(ticket.eventId)) out.get(ticket.eventId)?.push(ticket);
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
  const byEvent = await listTicketsForEvents(eventIds);
  const out = new Map<string, number>();
  for (const [eventId, tickets] of byEvent) {
    if (tickets.length > 0) {
      out.set(eventId, Math.min(...tickets.map((t) => t.price)));
    }
  }
  return out;
}

/** Create and persist a new ticket type, returning the stored record. */
export async function createTicketType(
  input: CreateTicketTypeInput,
): Promise<TicketType> {
  const ticketType: TicketType = {
    id: crypto.randomUUID(),
    eventId: input.eventId,
    name: input.name,
    price: input.price,
    capacity: input.capacity,
    salesStartAt: input.salesStartAt,
    salesEndAt: input.salesEndAt,
    category: input.category,
    description: input.description,
  };

  ticketTypes.push(ticketType);
  return ticketType;
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
 * Update a ticket type in place. Returns the record, or `undefined` when no
 * ticket type has the given id.
 */
export async function updateTicketType(
  id: string,
  patch: TicketTypeUpdate,
): Promise<TicketType | undefined> {
  const ticket = ticketTypes.find((t) => t.id === id);
  if (!ticket) return undefined;
  if (patch.name !== undefined) ticket.name = patch.name;
  if (patch.price !== undefined) ticket.price = patch.price;
  if (patch.capacity !== undefined) ticket.capacity = patch.capacity;
  if (patch.salesStartAt !== undefined) ticket.salesStartAt = patch.salesStartAt;
  if (patch.salesEndAt !== undefined) ticket.salesEndAt = patch.salesEndAt;
  if (patch.category !== undefined) ticket.category = patch.category;
  if (patch.description !== undefined) {
    ticket.description = patch.description || undefined;
  }
  return ticket;
}
