/**
 * Zod primitives shared across request schemas.
 *
 * Domain enums are declared once here and asserted against the TypeScript
 * unions in `types/`, so adding a member to one without the other is a
 * compile error rather than a runtime surprise.
 */

import { z } from "zod";

import { isStoredImage } from "@/lib/uploads";
import type {
  EventMode,
  EventStatus,
  EventVisibility,
  SessionAvailability,
  TicketCategory,
  WeekDay,
} from "@/types";

/** ISO 8601 date-time, e.g. `2026-07-19T18:30:00.000Z`. Offsets accepted. */
export const isoDateTime = z.iso.datetime({ offset: true });

/**
 * The looser date-time shape the session and sales-window handlers have always
 * accepted: seconds, milliseconds and the trailing `Z` are all optional.
 *
 * Kept verbatim so this refactor rejects nothing the previous hand-rolled
 * validators allowed. Tighten it once the Prisma mappers need real `Date`s.
 */
export const looseIsoDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?Z?$/, {
    message: "Expected an ISO 8601 date-time.",
  });

/** Calendar date, `YYYY-MM-DD`. */
export const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: "Expected a YYYY-MM-DD date.",
});

/** Wall-clock time, `HH:mm`. */
export const clockTime = z.string().regex(/^\d{2}:\d{2}$/, {
  message: "Expected an HH:mm time.",
});

/** A non-empty string, trimmed. */
export const nonEmpty = z.string().trim().min(1);

/**
 * An image the product itself stored — a Blob URL, or a legacy data URL.
 *
 * Uploads go to Blob now, so what arrives is a reference rather than the bytes.
 * A reference has to be *checked*: an unvalidated URL field accepts a pointer at
 * any host on the internet, and this one is rendered in other people's browsers
 * and printed onto tickets. `isStoredImage` allows exactly our Blob host.
 *
 * Data URLs stay valid because rows written before this still contain them, and
 * `512_000` keeps the old ceiling for those — a Blob URL is a couple of hundred
 * bytes and never approaches it.
 */
export const storedImage = z
  .string()
  .max(512_000, "تصویر باید کوچک‌تر از ۵۰۰ کیلوبایت باشد.")
  .refine(isStoredImage, "آدرس تصویر نامعتبر است.");

/** Integer amount in Toman. Never negative. */
export const money = z.number().int().min(0);

export const eventStatus = z.enum([
  "draft",
  "published",
  "cancelled",
  "completed",
]satisfies readonly EventStatus[]);

export const eventVisibility = z.enum([
  "public",
  "link",
  "audience",
] satisfies readonly EventVisibility[]);

export const eventMode = z.enum([
  "one-time",
  "recurring",
  "multi-session",
] satisfies readonly EventMode[]);

export const weekDay = z.enum([
  "SA",
  "SU",
  "MO",
  "TU",
  "WE",
  "TH",
  "FR",
] satisfies readonly WeekDay[]);

export const sessionAvailability = z.enum([
  "full",
  "almost-full",
  "soon",
  "available",
] satisfies readonly SessionAvailability[]);

export const ticketCategory = z.enum([
  "general",
  "vip",
  "student",
  "early-bird",
  "backstage",
  "group",
] satisfies readonly TicketCategory[]);

/**
 * Require a PATCH body to carry at least one field.
 *
 * Mirrors the previous hand-rolled validators, which returned `null` — and
 * therefore `400 INVALID_BODY` — for an empty patch.
 */
export function atLeastOneField<T extends z.ZodObject>(schema: T) {
  return schema.refine((value) => Object.keys(value).length > 0, {
    message: "No valid fields to update.",
  });
}
