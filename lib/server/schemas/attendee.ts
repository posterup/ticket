/** Request schemas for the CRM contact endpoints. */

import { z } from "zod";

/** `PATCH /api/attendees/:id` — replace the contact's tag labels. */
export const attendeeTagsSchema = z.object({
  tags: z.array(z.string()),
});
