/** Request schema for the SMS campaign endpoint. */

import { z } from "zod";

import { nonEmpty } from "./common";

/** `POST /api/sms/send` — blast a segment via sms.ir. */
export const sendSmsSchema = z.object({
  /** Whose balance is being spent — checked before anything is sent. */
  workspaceId: nonEmpty,
  segmentId: z.string(),
  message: nonEmpty,
});
