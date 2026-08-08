/**
 * Client-side state for the event composer (the redesigned create flow).
 *
 * Design goals (agreed with product): a sessions-first schedule model (an event
 * owns one or more sessions / سانس), flexible ticket kinds, and per-event
 * visibility. All string fields are kept as strings for the inputs and parsed
 * on submit.
 */

import { addMinutes, minutesBetween, venueIso } from "@/lib/format";
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
export type Visibility = "public" | "link" | "audience";

/** The kind of a ticket type — drives which fields/rules apply. */
export type TicketKind = "paid" | "free" | "donation" | "group" | "addon";

/** A concrete showtime produced by {@link expandSessions}. */
export interface SessionDraft {
  id: string;
  date: string;
  startTime: string;
  /** Length in whole minutes; the end is derived, never typed. */
  durationMin: number;
}

/**
 * A سانس (show time-slot). In the non-calendar model each سانس carries its own
 * `date`; in the calendar model the date is supplied by the range and `date`
 * is ignored.
 *
 * **Duration, not an end clock.** The organiser answers «چقدر طول می‌کشد؟» with
 * one number instead of setting two clocks that have to agree. Kept as a string
 * like every other draft field, because it is what an input holds mid-typing.
 * The stored `EventSession` still has a real `endAt` — the conversion happens
 * once, on submit, by adding the minutes to the start *instant*, which is also
 * what makes a سانس ending after midnight land on the next day instead of
 * before its own start.
 */
export interface TimeSlot {
  id: string;
  date: string;
  startTime: string;
  durationMin: string;
}

/**
 * The event schedule, driven by two flags:
 * - `range` on: a multi-day event — a single date range `[startDate, endDate]`
 *   with one shared time-slot, producing one سانس per day. Picked in one
 *   calendar + hour range (see {@link DateRangeSheet}).
 * - `calendar` on: performance weekdays (`byDay`) within `[startDate, endDate]`.
 * - both off: each سانس carries its own `date` (specific dated سانس‌ها).
 */
export interface ScheduleDraft {
  /** Multi-day scenario: one date range + one hour range → a سانس per day. */
  range?: boolean;
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
  /** Allowed CRM attendee-tag labels when `visibility` is `audience`. */
  audienceTags: string[];
  /** Registration needs organiser approval (invite-only). */
  requiresApproval: boolean;
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

/**
 * A blank سانس, pre-filled with an hour.
 *
 * The old empty end-time field had no sensible default — any clock we picked
 * would be a guess about when the event ends. A *length* does have one, and 60
 * minutes is both the commonest answer and an obviously-editable one, so the
 * organiser who leaves it alone still gets a valid سانس rather than an error.
 */
export const DEFAULT_DURATION_MIN = "60";

export function emptySlot(id: string): TimeSlot {
  return { id, date: "", startTime: "", durationMin: DEFAULT_DURATION_MIN };
}

/**
 * The shape a سانس takes once stored — `RecurrenceSchedule.slots`, and the
 * `HH:mm` pair the dashboard reads back off an `EventSession`.
 *
 * Storage keeps an end clock. The draft keeps a length. Both directions of that
 * translation live here, next to each other, so they cannot drift: everything
 * downstream of the wire — the public event page, the ICS export, the door
 * scanner — reads `endTime`/`endAt` and none of it had to change for the input
 * to change.
 */
export interface StoredSlot {
  id: string;
  startTime: string;
  endTime: string;
}

/** Stored end-clock → draft duration. Unreadable pairs fall back to the default. */
export function slotFromStored(s: StoredSlot): TimeSlot {
  const minutes = minutesBetween(s.startTime, s.endTime);
  return {
    id: s.id,
    date: "",
    startTime: s.startTime,
    durationMin: minutes && minutes > 0 ? String(minutes) : DEFAULT_DURATION_MIN,
  };
}

/** Draft duration → stored end clock. */
export function slotToStored(slot: TimeSlot): StoredSlot {
  return {
    id: slot.id,
    startTime: slot.startTime,
    endTime: addMinutes(slot.startTime, slotMinutes(slot)),
  };
}

/** A سانس as one line: «۱۸:۰۰–۱۹:۳۰», with the end derived, never typed. */
export function slotLabel(slot: TimeSlot): string {
  if (!slot.startTime) return "";
  const { endTime } = slotToStored(slot);
  return endTime ? `${slot.startTime}–${endTime}` : slot.startTime;
}

/**
 * A draft session as the two instants the wire carries.
 *
 * `endAt` is the start **instant** plus the minutes — not `venueIso(date,
 * endClock)`, which is what the composer used to do and which silently broke
 * the late show: a سانس starting 23:00 and running two hours produced an
 * `endAt` of 01:00 *on the same date*, twenty-two hours before its own start.
 * Nothing rejected it, and the event page rendered a negative-length session.
 * Adding minutes to an instant cannot express that.
 */
export function sessionInstants(s: SessionDraft): {
  startAt: string;
  endAt: string;
} {
  const startAt = venueIso(s.date, s.startTime);
  const minutes = s.durationMin > 0 ? s.durationMin : Number(DEFAULT_DURATION_MIN);
  return {
    startAt,
    endAt: new Date(Date.parse(startAt) + minutes * 60_000).toISOString(),
  };
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
  audienceTags: [],
  requiresApproval: false,
  ticketDesign: null,
  schedule: {
    range: false,
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
 * A slot's length as a number, falling back to the default rather than to zero.
 *
 * A blank or half-typed field is "not answered yet", and a zero-length سانس is
 * a session that ends the instant it starts — the availability indicator
 * divides by it and the door scanner treats it as already over. Validation
 * still rejects a blank duration before submit; this only decides what the live
 * preview shows while the organiser is mid-edit.
 */
function slotMinutes(slot: TimeSlot): number {
  const n = Number(slot.durationMin);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : Number(DEFAULT_DURATION_MIN);
}

/**
 * Resolve the draft's schedule into concrete sessions. Every day in
 * `[startDate, endDate]` (filtered to `byDay` when `calendar` is on) is paired
 * with each defined سانس time-slot. Client preview and submit share this.
 */
export function expandSessions(draft: CreateDraft): SessionDraft[] {
  return expandSchedule(draft.schedule);
}

/**
 * Resolve a {@link ScheduleDraft} into concrete sessions. Shared by the create
 * composer and the dashboard recurrence editor so both generate identically.
 */
export function expandSchedule(schedule: ScheduleDraft): SessionDraft[] {
  const { range, calendar, startDate, endDate, byDay, slots, daySlots, exceptions } =
    schedule;

  // Multi-day range: one سانس per day across [startDate, endDate], all sharing
  // the single defined hour range.
  if (range) {
    if (!startDate) return [];
    const slot = slots.find((s) => s.startTime);
    if (!slot) return [];
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = endDate ? new Date(`${endDate}T00:00:00Z`) : start;
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end < start
    ) {
      return [];
    }
    const out: SessionDraft[] = [];
    const cursor = new Date(start);
    while (cursor <= end && out.length < MAX_SESSIONS) {
      const date = cursor.toISOString().slice(0, 10);
      out.push({
        id: `${date}-${slot.id}`,
        date,
        startTime: slot.startTime,
        durationMin: slotMinutes(slot),
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return out;
  }

  // Non-calendar: each سانس is its own dated showtime.
  if (!calendar) {
    return slots
      .filter((s) => s.date && s.startTime)
      .map((s) => ({
        id: `${s.date}-${s.id}`,
        date: s.date,
        startTime: s.startTime,
        durationMin: slotMinutes(s),
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
          durationMin: slotMinutes(slot),
        });
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/**
 * What a blank capacity field means.
 *
 * `TicketType.capacity` is a non-null `Int` and `reserve()` uses it as a hard
 * ceiling — `sold + reserved + qty <= capacity` — so a blank field sent as `0`
 * makes the ticket unsellable. The capacity input's placeholder says
 * «نامحدود», and the wizard was turning that promise into zero: the event page
 * offered «ورود آزاد» and the order was refused with «ظرفیت تکمیل شده است».
 *
 * A large number rather than a nullable column: `capacity` is read as a
 * denominator by the availability indicator and as the allocation ceiling by
 * the seat map, and both behave correctly with a big value. Making it nullable
 * would mean teaching every one of those to handle "no ceiling".
 */
export const UNLIMITED_CAPACITY = 1_000_000;
