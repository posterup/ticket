/** Request schemas for the order endpoints. */

import { z } from "zod";

import { nonEmpty } from "./common";

/** `POST /api/orders` */
export const createOrderSchema = z.object({
  eventId: nonEmpty,
  sessionId: z.string().optional(),
  items: z
    .array(
      z.object({
        ticketTypeId: nonEmpty,
        // A per-line cap; the real limit is the ticket type's capacity.
        quantity: z.number().int().min(1).max(20),
      }),
    )
    // Assigned seating derives its own lines from the seats, so `items` may be
    // empty when `seats` is present. `createOrder` rejects a request with
    // neither.
    .default([]),
  /**
   * Assigned seating. The seats decide the ticket type and the price, so this
   * carries neither — only which seats, by section-local index.
   */
  seats: z
    .array(
      z.object({
        section: nonEmpty,
        seats: z.array(z.number().int().min(0)).min(1).max(10),
      }),
    )
    .optional(),
  buyerName: nonEmpty.max(120),
  buyerPhone: z
    .string()
    .trim()
    .regex(/^(\+98|0)?9\d{9}$/, { message: "شماره موبایل معتبر وارد کنید." }),
  discountCode: z.string().optional(),
});
