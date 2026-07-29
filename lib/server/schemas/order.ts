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
    .min(1),
  buyerName: nonEmpty.max(120),
  buyerPhone: z
    .string()
    .trim()
    .regex(/^(\+98|0)?9\d{9}$/, { message: "شماره موبایل معتبر وارد کنید." }),
  discountCode: z.string().optional(),
});
