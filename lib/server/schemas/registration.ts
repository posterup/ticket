/** Request schemas for the event-registration endpoints. */

import { z } from "zod";

import type { RegistrationStatus } from "@/types";

/** `PATCH /api/events/:id/registrations/:registrationId` */
export const registrationStatusSchema = z.object({
  status: z.enum([
    "pending",
    "accepted",
    "rejected",
  ] satisfies readonly RegistrationStatus[]),
});
