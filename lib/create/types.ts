/**
 * Client-side state for the event composer (the redesigned create flow).
 *
 * Design goals (agreed with product): a sessions-first schedule model (an event
 * owns one or more sessions / سانس), flexible ticket kinds, and per-event
 * visibility. All string fields are kept as strings for the inputs and parsed
 * on submit.
 */

import type { WeekDay } from "@/types";
import type { TicketTemplate } from "@/components/tickets/TicketPreview";

export type LocationMode = "in-person" | "online" | "hybrid";

/** An uploaded gallery item (image or video), stored as a data URL. */
export interface MediaItem {
  id: string;
  type: "image" | "video";
  url: string;
  name: string;
}
export type Visibility = "public" | "unlisted";

/** The kind of a ticket type — drives which fields/rules apply. */
export type TicketKind = "paid" | "free" | "donation" | "group" | "addon";

/** A concrete showtime produced by {@link expandSessions}. */
export interface SessionDraft {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}

/**
 * A سانس (show time-slot). In the non-calendar model each سانس carries its own
 * `date`; in the calendar model the date is supplied by the range and `date`
 * is ignored.
 */
export interface TimeSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}

/**
 * The event schedule, driven by one toggle (`calendar`):
 * - `calendar` off: a plain date range `[startDate, endDate]`.
 * - `calendar` on: performance weekdays (`byDay`) within `[startDate, endDate]`.
 * Both models define one or more سانس time-slots (`slots`).
 */
export interface ScheduleDraft {
  calendar: boolean;
  startDate: string;
  endDate: string;
  byDay: WeekDay[];
  /** Default سانس‌ها applied to every performance day. */
  slots: TimeSlot[];
  /** Extra سانس‌ها for a specific weekday (calendar model). */
  daySlots: Partial<Record<WeekDay, TimeSlot[]>>;
  /** Dates (`YYYY-MM-DD`) to skip — e.g. public holidays. */
  exceptions: string[];
}

export interface TicketTypeDraft {
  id: string;
  name: string;
  kind: TicketKind;
  /** Toman; used by `paid`, `group` (bundle price) and `addon`. */
  price: string;
  /** Minimum amount for `donation`. */
  minPrice: string;
  /** People per bundle for `group`. */
  groupSize: string;
  capacity: string;
  minPerOrder: string;
  maxPerOrder: string;
  /** «زمان‌بندی فروش»: when off, sales are open with no window. */
  salesSchedule: boolean;
  /** Optional sales window (Gregorian `YYYY-MM-DD`). */
  salesStart: string;
  salesEnd: string;
  /** «فروش زودهنگام»: a lower price for purchases before `earlyBirdUntil`. */
  earlyBird: boolean;
  earlyBirdPrice: string;
  earlyBirdUntil: string;
  /** When true the ticket applies to every session; else to `sessionIds`. */
  appliesToAll: boolean;
  sessionIds: string[];
  /** Hidden ticket, unlocked by an access code (private/VIP). */
  hidden: boolean;
  accessCode: string;
  /**
   * «دربستی» (charter / whole booking): a fixed base price plus a per-person
   * fee, for between `buyoutMin` and `buyoutMax` people.
   */
  buyout: boolean;
  /** Fixed base price of the charter, in Toman. */
  buyoutBasePrice: string;
  /** Extra fee per person, in Toman. */
  buyoutPerPerson: string;
  /** Minimum number of people. */
  buyoutMin: string;
  /** Maximum number of people. */
  buyoutMax: string;
  description: string;
}

export interface CreateDraft {
  title: string;
  description: string;
  /** Discovery category label (also used as the primary tag). */
  category: string;
  /** Cover image (data URL) shown as the event poster. */
  poster: string | null;
  /** Additional images/videos for the event page. */
  gallery: MediaItem[];
  location: {
    mode: LocationMode;
    /** Province (استان) — chosen from a fixed list. */
    province: string;
    /** City (شهر) — chosen from the selected province's cities. */
    city: string;
    /** Optional venue/place name (نام محل). */
    venueName: string;
    address: string;
    onlineUrl: string;
    /** Dropped pin coordinates (null until the organizer places one). */
    lat: number | null;
    lng: number | null;
    /** When true, the exact address and map pin stay hidden on the event page. */
    hideAddress: boolean;
  };
  visibility: Visibility;
  /** Optional custom ticket appearance; `null` uses the default design. */
  ticketDesign: TicketTemplate | null;
  schedule: ScheduleDraft;
  ticketTypes: TicketTypeDraft[];
}

/** Discovery categories offered in the composer (label doubles as a tag). */
export const EVENT_CATEGORIES = [
  "موسیقی",
  "هنر",
  "فناوری",
  "آموزش",
  "ورزش",
  "غذا",
  "کسب‌وکار",
  "سایر",
] as const;

/** A neutral starting ticket design when the organizer opts to customize. */
export function defaultTicketDesign(): TicketTemplate {
  return {
    accent: "#111111",
    surface: "light",
    bgColor: null,
    bgImage: null,
    logo: null,
    showCategory: true,
    showDate: true,
    showVenue: true,
    note: "این بلیت را هنگام ورود ارائه دهید.",
  };
}

export function emptySlot(id: string): TimeSlot {
  return { id, date: "", startTime: "", endTime: "" };
}

export function emptyTicket(id: string, kind: TicketKind = "paid"): TicketTypeDraft {
  return {
    id,
    name: "",
    kind,
    price: "",
    minPrice: "",
    groupSize: "2",
    capacity: "",
    minPerOrder: "1",
    maxPerOrder: "10",
    salesSchedule: false,
    salesStart: "",
    salesEnd: "",
    earlyBird: false,
    earlyBirdPrice: "",
    earlyBirdUntil: "",
    appliesToAll: true,
    sessionIds: [],
    hidden: false,
    accessCode: "",
    buyout: false,
    buyoutBasePrice: "",
    buyoutPerPerson: "",
    buyoutMin: "",
    buyoutMax: "",
    description: "",
  };
}

/**
 * Initial composer state. The first session and ticket use stable ids so the
 * server and client render identically (no hydration mismatch); later ids are
 * generated on the client.
 */
export const initialDraft: CreateDraft = {
  title: "",
  description: "",
  category: "",
  poster: null,
  gallery: [],
  location: {
    mode: "in-person",
    province: "",
    city: "",
    venueName: "",
    address: "",
    onlineUrl: "",
    lat: null,
    lng: null,
    hideAddress: false,
  },
  visibility: "public",
  ticketDesign: null,
  schedule: {
    calendar: false,
    startDate: "",
    endDate: "",
    byDay: [],
    slots: [emptySlot("slot-1")],
    daySlots: {},
    exceptions: [],
  },
  ticketTypes: [{ ...emptyTicket("ticket-1"), name: "بلیت عمومی" }],
};

/** iCalendar weekday code for a `getUTCDay()` index (0 = Sunday). */
const WEEKDAY_OF: WeekDay[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** Guard so a wide range × many slots can't explode the session list. */
const MAX_SESSIONS = 366;

/**
 * Resolve the draft's schedule into concrete sessions. Every day in
 * `[startDate, endDate]` (filtered to `byDay` when `calendar` is on) is paired
 * with each defined سانس time-slot. Client preview and submit share this.
 */
export function expandSessions(draft: CreateDraft): SessionDraft[] {
  const { calendar, startDate, endDate, byDay, slots, daySlots, exceptions } =
    draft.schedule;

  // Non-calendar: each سانس is its own dated showtime.
  if (!calendar) {
    return slots
      .filter((s) => s.date && s.startTime)
      .map((s) => ({
        id: `${s.date}-${s.id}`,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
      }));
  }

  if (!startDate) return [];
  const baseSlots = slots.filter((s) => s.startTime);
  if (baseSlots.length === 0) return [];

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = endDate ? new Date(`${endDate}T00:00:00Z`) : start;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return [];
  }
  const skip = new Set(exceptions);

  const out: SessionDraft[] = [];
  const cursor = new Date(start);
  while (cursor <= end && out.length < MAX_SESSIONS) {
    const date = cursor.toISOString().slice(0, 10);
    const weekday = WEEKDAY_OF[cursor.getUTCDay()];
    const include = !calendar || byDay.length === 0 || byDay.includes(weekday);
    if (include && !skip.has(date)) {
      const extra = calendar ? (daySlots[weekday] ?? []).filter((s) => s.startTime) : [];
      for (const slot of [...baseSlots, ...extra]) {
        out.push({
          id: `${date}-${slot.id}`,
          date,
          startTime: slot.startTime,
          endTime: slot.endTime,
        });
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}
