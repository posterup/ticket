/** Request schemas for the workspace finance endpoints. */

import { z } from "zod";

import { money, nonEmpty } from "./common";

/** `POST /api/workspaces/:slug/bank-accounts` */
export const bankAccountSchema = z.object({
  /** Iranian IBAN: `IR` followed by 24 digits. */
  iban: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s/g, "").toUpperCase())
    .refine((v) => /^IR\d{24}$/.test(v), {
      message: "شماره شبا معتبر وارد کنید (IR و ۲۴ رقم).",
    }),
  bankName: nonEmpty.max(80),
  holder: nonEmpty.max(120),
});

/** `POST /api/workspaces/:slug/withdrawals` */
export const withdrawalSchema = z.object({
  amount: money.min(1),
  bankAccountId: nonEmpty,
});
