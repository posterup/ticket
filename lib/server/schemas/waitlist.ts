/** Request schemas for the waitlist endpoints. */

import { z } from "zod";

import { nonEmpty } from "./common";

const mobile = z
  .string()
  .trim()
  .regex(/^(\+98|0)?9\d{9}$/, { message: "شماره موبایل معتبر وارد کنید." });

export const joinWaitlistSchema = z.object({
  name: nonEmpty.max(120),
  phone: mobile,
  quantity: z.number().int().min(1).max(20),
});

/**
 * The phone is optional and travels in the `x-waitlist-phone` header:
 * present, it looks up one person's own place; absent,
 * the organiser is asking for the whole queue.
 */
export const waitlistLookupSchema = z.object({
  phone: mobile.optional(),
});
