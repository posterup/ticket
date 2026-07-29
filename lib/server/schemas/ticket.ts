/** Request schemas for the ticket-type endpoints. */

import { z } from "zod";

import {
  atLeastOneField,
  looseIsoDateTime,
  money,
  nonEmpty,
  ticketCategory,
} from "./common";

/** `GET /api/tickets?eventId=` */
export const listTicketsQuery = z.object({
  eventId: z.string().optional(),
});

/** `POST /api/tickets` */
export const createTicketTypeSchema = z.object({
  eventId: nonEmpty,
  name: nonEmpty,
  price: money,
  capacity: z.number().int().min(0),
  salesStartAt: looseIsoDateTime,
  salesEndAt: looseIsoDateTime,
  category: ticketCategory,
  description: z.string().optional(),
});

/** `PATCH /api/tickets/:id` — any subset, but at least one field. */
export const ticketTypeUpdateSchema = atLeastOneField(
  z.object({
    name: nonEmpty.optional(),
    price: money.optional(),
    capacity: z.number().int().min(0).optional(),
    salesStartAt: looseIsoDateTime.optional(),
    salesEndAt: looseIsoDateTime.optional(),
    category: ticketCategory.optional(),
    description: z.string().optional(),
  }),
).refine(
  (t) => !(t.salesStartAt && t.salesEndAt) || t.salesEndAt >= t.salesStartAt,
  { message: "salesEndAt must not precede salesStartAt.", path: ["salesEndAt"] },
);
