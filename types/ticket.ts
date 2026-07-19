import type { IsoDateTime, Money } from "./api";

/** Pricing/audience bucket a ticket type belongs to. */
export type TicketCategory =
  | "general"
  | "vip"
  | "student"
  | "early-bird"
  | "backstage"
  | "group";

/** Lifecycle state of an individual issued ticket. */
export type TicketStatus = "issued" | "checked-in" | "cancelled" | "refunded";

/**
 * A sellable ticket definition created in step 3 of the wizard. An event may
 * have unlimited ticket types (e.g. general, VIP, student…).
 */
export interface TicketType {
  id: string;
  eventId: string;
  name: string;
  /** Price in Toman as an integer; `0` for free tickets. */
  price: Money;
  /** Number of tickets of this type available for sale. */
  capacity: number;
  salesStartAt: IsoDateTime;
  salesEndAt: IsoDateTime;
  category: TicketCategory;
  description?: string;
}

/** A concrete ticket issued to an attendee. */
export interface Ticket {
  id: string;
  ticketTypeId: string;
  holderName: string;
  /** Opaque token encoded into the entry QR code. */
  qrToken: string;
  status: TicketStatus;
  issuedAt: IsoDateTime;
}

/** Payload accepted by `createTicketType`; server fills id. */
export interface CreateTicketTypeInput {
  eventId: string;
  name: string;
  price: Money;
  capacity: number;
  salesStartAt: IsoDateTime;
  salesEndAt: IsoDateTime;
  category: TicketCategory;
  description?: string;
}
