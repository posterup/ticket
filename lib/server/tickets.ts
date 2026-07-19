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
