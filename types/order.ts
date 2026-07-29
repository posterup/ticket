import type { IsoDateTime, Money } from "./api";

/**
 * Lifecycle of an order. `paid` is terminal except for `refunded`; every other
 * exit releases the inventory the order was holding.
 */
export type OrderStatus =
  | "pending-payment"
  | "paid"
  | "expired"
  | "failed"
  | "cancelled"
  | "refunded";

export interface OrderItem {
  id: string;
  ticketTypeId: string;
  /** Name at the time of purchase, so a later rename does not rewrite history. */
  ticketTypeName: string;
  quantity: number;
  /** Snapshot: the type's price may change after the order is placed. */
  unitPrice: Money;
}

export interface Order {
  id: string;
  /** Short human tracking code (کد پیگیری) shown to the buyer. */
  code: string;
  eventId: string;
  sessionId?: string;
  buyerName: string;
  buyerPhone: string;
  items: OrderItem[];
  subtotal: Money;
  discountAmount: Money;
  total: Money;
  status: OrderStatus;
  /** When the inventory hold lapses, for orders awaiting payment. */
  expiresAt: IsoDateTime;
  paidAt?: IsoDateTime;
  createdAt: IsoDateTime;
}

/** An issued ticket, as shown to its holder. */
export interface IssuedTicket {
  id: string;
  orderId: string;
  orderCode: string;
  eventId: string;
  eventTitle: string;
  ticketTypeName: string;
  holderName: string;
  /** What the door scanner reads. */
  qrToken: string;
  status: "issued" | "checked-in" | "cancelled" | "refunded";
  startAt?: IsoDateTime;
  venueName?: string;
  issuedAt: IsoDateTime;
}

export interface CreateOrderInput {
  eventId: string;
  sessionId?: string;
  items: { ticketTypeId: string; quantity: number }[];
  buyerName: string;
  buyerPhone: string;
  discountCode?: string;
}
