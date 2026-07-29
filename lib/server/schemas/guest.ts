/** Request schemas for the event-guest endpoints. */

import { z } from "zod";

import type { GuestRsvp } from "@/types";

import { nonEmpty } from "./common";

/** `POST /api/events/:id/guests` */
export const addGuestSchema = z.object({
  sessionId: nonEmpty,
  contact: nonEmpty,
  channel: z.enum(["phone", "username"]),
});

/** `PATCH /api/events/:id/guests/:guestId` */
export const guestStatusSchema = z.object({
  status: z.enum([
    "pending",
    "going",
    "declined",
  ] satisfies readonly GuestRsvp[]),
});
