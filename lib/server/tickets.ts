/**
 * Ticket-type data-access functions over the in-memory {@link ticketTypes}
 * store. Replace the array operations with real queries when a datastore is
 * added.
 */

import type { CreateTicketTypeInput, TicketType } from "@/types";

import { ticketTypes } from "./store";

/** Return ticket types, optionally scoped to a single event. */
export function listTickets(eventId?: string): TicketType[] {
  if (eventId === undefined) {
    return [...ticketTypes];
  }
  return ticketTypes.filter((ticket) => ticket.eventId === eventId);
}

/** Create and persist a new ticket type, returning the stored record. */
export function createTicketType(input: CreateTicketTypeInput): TicketType {
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
export function updateTicketType(
  id: string,
  patch: TicketTypeUpdate,
): TicketType | undefined {
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
