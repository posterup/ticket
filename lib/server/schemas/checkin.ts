/** Request schema for the door check-in endpoint. */

import { z } from "zod";

import { nonEmpty } from "./common";

/**
 * `POST /api/checkin`
 *
 * `eventId` is required so a ticket for another event is refused rather than
 * admitted at the wrong door.
 */
export const checkinSchema = z.object({
  eventId: nonEmpty,
  qrToken: nonEmpty,
  checked: z.boolean(),
});
