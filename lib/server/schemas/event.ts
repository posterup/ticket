/** Request schemas for the event, venue and session endpoints. */

import { z } from "zod";

import {
  atLeastOneField,
  calendarDate,
  clockTime,
  eventMode,
  eventStatus,
  eventVisibility,
  looseIsoDateTime,
  nonEmpty,
  sessionAvailability,
  weekDay,
} from "./common";

/**
 * One سانس time-slot. A missing or malformed `endTime` falls back to
 * `startTime`, matching the previous `parseSlot` behaviour.
 */
const scheduleSlot = z
  .object({
    id: nonEmpty,
    startTime: clockTime,
    endTime: clockTime.optional().catch(undefined),
  })
  .transform((slot) => ({
    id: slot.id,
    startTime: slot.startTime,
    endTime: slot.endTime ?? slot.startTime,
  }));

/**
 * Calendar schedule of a recurring event.
 *
 * Two lenient fallbacks are preserved from `parseRecurrenceSchedule`: a missing
 * or malformed `endDate` falls back to `startDate`, and malformed `exceptions`
 * degrade to an empty list rather than failing the whole request.
 */
export const recurrenceScheduleSchema = z
  .object({
    startDate: calendarDate,
    endDate: calendarDate.optional().catch(undefined),
    byDay: z.array(weekDay),
    slots: z.array(scheduleSlot).min(1),
    daySlots: z.partialRecord(weekDay, z.array(scheduleSlot)).optional(),
    exceptions: z.array(calendarDate).catch([]),
  })
  .transform((spec) => {
    const daySlots = Object.fromEntries(
      Object.entries(spec.daySlots ?? {}).filter(
        ([, slots]) => (slots?.length ?? 0) > 0,
      ),
    );
    return {
      startDate: spec.startDate,
      endDate: spec.endDate ?? spec.startDate,
      byDay: spec.byDay,
      slots: spec.slots,
      exceptions: spec.exceptions,
      ...(Object.keys(daySlots).length > 0 ? { daySlots } : {}),
    };
  });

const recurrenceRuleSchema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly", "weekday"]),
  interval: z.number().int().min(1),
  byDay: z.array(weekDay).optional(),
  until: looseIsoDateTime.optional(),
  count: z.number().int().min(1).optional(),
});

const venueInput = z.object({
  name: z.string(),
  province: z.string().optional(),
  city: z.string(),
  address: z.string(),
  capacity: z.number().int().min(0),
  onlineUrl: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  hideAddress: z.boolean().optional(),
});

const sessionInput = z.object({
  startAt: looseIsoDateTime,
  endAt: looseIsoDateTime,
  venueId: z.string().optional(),
  cancelled: z.boolean().optional(),
  availability: sessionAvailability.optional(),
});

/** `POST /api/events` */
export const createEventSchema = z.object({
  /** Optional: defaults to the caller's own workspace. */
  workspaceId: z.string().optional(),
  title: nonEmpty,
  description: z.string(),
  mode: eventMode,
  venue: venueInput,
  sessions: z.array(sessionInput).min(1),
  recurrence: recurrenceRuleSchema.optional(),
  tags: z.array(z.string()).optional(),
  status: eventStatus.optional(),
  visibility: eventVisibility.optional(),
  audienceTags: z.array(z.string()).optional(),
  requiresApproval: z.boolean().optional(),
});

/** `PATCH /api/events/:id` — any subset, but at least one field. */
export const eventUpdateSchema = atLeastOneField(
  z.object({
    title: nonEmpty.optional(),
    description: z.string().optional(),
    status: eventStatus.optional(),
    visibility: eventVisibility.optional(),
    audienceTags: z.array(z.string()).optional(),
    requiresApproval: z.boolean().optional(),
    slug: nonEmpty.optional(),
    recurrenceSchedule: recurrenceScheduleSchema.optional(),
  }),
);

/** `PATCH /api/events/:id/venue` */
export const venueUpdateSchema = atLeastOneField(
  z.object({
    name: z.string().optional(),
    province: z.string().optional(),
    city: z.string().optional(),
    address: z.string().optional(),
    capacity: z.number().int().min(0).optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    hideAddress: z.boolean().optional(),
  }),
);

/** `POST /api/events/:id/sessions` */
export const createSessionSchema = z
  .object({
    startAt: looseIsoDateTime,
    endAt: looseIsoDateTime,
    availability: sessionAvailability.optional(),
  })
  .refine((s) => s.endAt >= s.startAt, {
    message: "endAt must not precede startAt.",
    path: ["endAt"],
  });

/** `PATCH /api/events/:id/sessions/:sessionId` */
export const sessionUpdateSchema = atLeastOneField(
  z.object({
    startAt: looseIsoDateTime.optional(),
    endAt: looseIsoDateTime.optional(),
    cancelled: z.boolean().optional(),
    availability: sessionAvailability.optional(),
  }),
).refine((s) => !(s.startAt && s.endAt) || s.endAt >= s.startAt, {
  message: "endAt must not precede startAt.",
  path: ["endAt"],
});
