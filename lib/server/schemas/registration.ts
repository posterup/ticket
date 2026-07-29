/** Request schemas for the event-registration endpoints. */

import { z } from "zod";

import type { RegistrationStatus } from "@/types";

import { nonEmpty } from "./common";

/**
 * `POST /api/events/:id/registrations` — an attendee's request to join an
 * approval-gated event. Phone is validated in the Iranian mobile shapes the
 * checkout form already accepts.
 */
export const createRegistrationSchema = z.object({
  name: nonEmpty,
  phone: z
    .string()
    .trim()
    .regex(/^(\+98|0)?9\d{9}$/, { message: "شماره موبایل معتبر وارد کنید." }),
  tickets: z.number().int().min(1).max(20),
});

/** `PATCH /api/events/:id/registrations/:registrationId` */
export const registrationStatusSchema = z.object({
  status: z.enum([
    "pending",
    "accepted",
    "rejected",
  ] satisfies readonly RegistrationStatus[]),
});
