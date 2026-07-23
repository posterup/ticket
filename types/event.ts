import type { IsoDateTime } from "./api";

/** Lifecycle state of an event. */
export type EventStatus = "draft" | "published" | "cancelled" | "completed";

/** Who may find and register: `public` = discoverable; `link` = only via link. */
export type EventVisibility = "public" | "link";

/**
 * Scheduling mode chosen in step 2 of the ticket-creation wizard.
 * - `one-time`: a single session at a fixed date/time.
 * - `recurring`: sessions generated from a {@link RecurrenceRule}.
 * - `multi-session`: an explicit list of distinct sessions.
 */
export type EventMode = "one-time" | "recurring" | "multi-session";

/** How often a recurring event repeats. `weekday` means Sat–Wed style workdays. */
export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "weekday";

/** Day-of-week codes used by {@link RecurrenceRule.byDay} (iCalendar style). */
export type WeekDay = "SA" | "SU" | "MO" | "TU" | "WE" | "TH" | "FR";

/** A physical or virtual location where an event takes place. */
export interface Venue {
  id: string;
  name: string;
  /** Province (استان), e.g. `تهران`. */
  province?: string;
  /** City, e.g. `تهران`. */
  city: string;
  address: string;
  /** Maximum standing/seated capacity of the venue itself. */
  capacity: number;
  /** Present for online or hybrid venues. */
  onlineUrl?: string;
  /** Dropped-pin coordinates, when the organizer placed one. */
  lat?: number;
  lng?: number;
  /** When true, hide the exact address and pin from the public event page. */
  hideAddress?: boolean;
}

/**
 * Repetition rule for a `recurring` event. Either `until` or `count`
 * bounds the series; if both are omitted the series is treated as open-ended.
 */
export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  /** Repeat every `interval` units of `frequency` (e.g. every 2 weeks). */
  interval: number;
  /** Restrict weekly recurrence to these days. */
  byDay?: WeekDay[];
  /** Inclusive end date of the series. */
  until?: IsoDateTime;
  /** Total number of occurrences to generate. */
  count?: number;
}

/** A single concrete occurrence of an event. */
export interface EventSession {
  id: string;
  eventId: string;
  startAt: IsoDateTime;
  endAt: IsoDateTime;
  /** Overrides the event venue for this occurrence when set. */
  venueId?: string;
  /** When true, this سانس was cancelled by the organizer. */
  cancelled?: boolean;
}

/**
 * Core CRM/ticketing entity. An event owns its schedule (via {@link EventMode})
 * and, separately, its ticket types (see `types/ticket.ts`).
 */
export interface Event {
  id: string;
  title: string;
  description: string;
  status: EventStatus;
  mode: EventMode;
  venue: Venue;
  /** Concrete sessions. `one-time` events carry exactly one. */
  sessions: EventSession[];
  /** Present only when `mode === "recurring"`. */
  recurrence?: RecurrenceRule;
  /** Free-form organiser-facing labels. */
  tags: string[];
  /** Discovery categories for the explore page (e.g. «هنر»، «آشپزی»). */
  categories?: string[];
  /** Who can find/register: `public` (default) or `link`-only. */
  visibility?: EventVisibility;
  /** When true (link events), registrations need organiser approval. */
  requiresApproval?: boolean;
  /** When true, a sold-out event offers a waitlist instead of closing sales. */
  waitlist?: boolean;
  /** Custom public URL slug for the event page; falls back to `id`. */
  slug?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** Payload accepted by `createEvent`; server fills ids and timestamps. */
export interface CreateEventInput {
  title: string;
  description: string;
  mode: EventMode;
  venue: Omit<Venue, "id">;
  sessions: Array<Omit<EventSession, "id" | "eventId">>;
  recurrence?: RecurrenceRule;
  tags?: string[];
  status?: EventStatus;
}
