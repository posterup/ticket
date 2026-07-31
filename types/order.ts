import type { TicketDesign } from "./event";
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
  /** When the showing ends, for the calendar entry. */
  endAt?: IsoDateTime;
  venueName?: string;
  issuedAt: IsoDateTime;
  /** Present for assigned seating — what the holder should actually sit in. */
  seat?: { section: string; row: string; number: string };
  /**
   * The organiser's «قالب بلیت», so the buyer sees the ticket that was
   * designed for them rather than a generic one.
   */
  design?: TicketDesign;
  /**
   * The showing was called off.
   *
   * Distinct from `status`, which describes the *ticket* — a ticket for a
   * cancelled show is still `issued` until someone refunds it, and without this
   * the ticket page cheerfully reported «معتبر» over a scannable code for an
   * event that was not happening. The SMS is not enough: it can be missed,
   * deleted, or sent to a phone the buyer no longer carries.
   */
  showCancelled?: boolean;
}

export interface CreateOrderInput {
  eventId: string;
  sessionId?: string;
  /**
   * Unreserved seating. Ignored when `seats` is present — assigned seating
   * derives its own lines, because the seats decide the ticket type.
   */
  items: { ticketTypeId: string; quantity: number }[];
  /**
   * Assigned seating: which seats, by section-local index. The caller must
   * already hold every one of them.
   */
  seats?: { section: string; seats: number[] }[];
  buyerName: string;
  buyerPhone: string;
  discountCode?: string;
}
