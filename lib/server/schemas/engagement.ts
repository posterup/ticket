/** Request schemas for the attendee engagement endpoints. */

import { z } from "zod";

/** `PUT /api/events/:id/bookmark` — `null` clears the mark. */
export const bookmarkSchema = z.object({
  state: z.enum(["interested", "going"]).nullable(),
});
