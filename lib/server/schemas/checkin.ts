/** Request schema for the door check-in endpoint. */

import { z } from "zod";

import { nonEmpty } from "./common";

/** `POST /api/checkin` — record or clear a holder's check-in. */
export const checkinSchema = z.object({
  holderId: nonEmpty,
  checked: z.boolean(),
});
