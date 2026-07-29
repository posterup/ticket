/** Request schemas for the discount-code endpoints. */

import { z } from "zod";

import type { DiscountKind } from "@/types";

import { looseIsoDateTime } from "./common";

const discountKind = z.enum(["percent", "fixed"] satisfies readonly DiscountKind[]);

/** `GET /api/discounts?eventId=` */
export const listDiscountsQuery = z.object({
  eventId: z.string().optional(),
});

/**
 * `POST /api/discounts`
 *
 * `eventId: null` scopes the code to every event. Codes are normalised to
 * upper case here so the duplicate check and storage agree on one form.
 */
export const createDiscountSchema = z
  .object({
    eventId: z.string().nullable(),
    sessionId: z.string().nullish().transform((v) => v ?? null),
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{3,20}$/, {
        message: "Codes are 3–20 letters or digits.",
      })
      .transform((c) => c.toUpperCase()),
    kind: discountKind,
    value: z.number().int().positive(),
    maxRedemptions: z.number().int().positive().nullable(),
    expiresAt: looseIsoDateTime.nullable(),
  })
  .refine((d) => d.kind !== "percent" || d.value <= 100, {
    message: "A percentage discount cannot exceed 100.",
    path: ["value"],
  });

/** `POST /api/discounts/validate` */
export const validateDiscountSchema = z.object({
  code: z.string(),
  eventId: z.string(),
  subtotal: z.number().finite(),
});
