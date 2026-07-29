/** Request schema for the SMS campaign endpoint. */

import { z } from "zod";

import { nonEmpty } from "./common";

/** `POST /api/sms/send` — blast a segment via sms.ir. */
export const sendSmsSchema = z.object({
  segmentId: z.string(),
  message: nonEmpty,
});
