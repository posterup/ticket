/** Request schemas for the auth endpoints. */

import { z } from "zod";

import type { WorkspaceType } from "@/types";

import { nonEmpty } from "./common";

/** Accepts the shapes Iranians actually type; normalised server-side. */
const phone = z
  .string()
  .trim()
  .regex(/^(\+98|98|0)?9\d{9}$/, { message: "شماره موبایل معتبر وارد کنید." });

/** `POST /api/auth/otp/request` */
export const otpRequestSchema = z.object({ phone });

/** `POST /api/auth/otp/verify` */
export const otpVerifySchema = z.object({
  phone,
  code: z.string().trim().regex(/^\d{6}$/, { message: "کد ۶ رقمی را وارد کنید." }),
});

/** `POST /api/auth/register` — become an organizer. */
export const registerSchema = z.object({
  fullName: nonEmpty.max(120),
  workspaceName: nonEmpty.max(120),
  workspaceType: z.enum(["personal", "business"] satisfies readonly WorkspaceType[]),
});
