/**
 * Client-side state for the event composer (the redesigned create flow).
 *
 * Design goals (agreed with product): a sessions-first schedule model (an event
 * owns one or more sessions / سانس), flexible ticket kinds, and per-event
 * visibility. All string fields are kept as strings for the inputs and parsed
 * on submit.
 */

import type { RecurrenceFrequency, WeekDay } from "@/types";
import type { TicketTemplate } from "@/components/tickets/TicketPreview";

export type LocationMode = "in-person" | "online" | "hybrid";

/** An uploaded gallery item (image or video), stored as a data URL. */
export interface MediaItem {
  id: string;
  type: "image" | "video";
  url: string;
  name: string;
}
export type Visibility = "public" | "unlisted" | "private";
export type ScheduleMode = "single" | "recurring" | "multi";

/** The kind of a ticket type — drives which fields/rules apply. */
export type TicketKind = "paid" | "free" | "donation" | "group" | "addon";

/** A concrete showtime / سانس. Dates are stored Gregorian `YYYY-MM-DD`. */
export interface SessionDraft {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface RecurrenceDraft {
  frequency: RecurrenceFrequency;
  interval: string;
  byDay: WeekDay[];
  /** Number of occurrences to generate. */
  count: string;
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
  /** Optional sales window (Gregorian `YYYY-MM-DD`). */
  salesStart: string;
  salesEnd: string;
  /** When true the ticket applies to every session; else to `sessionIds`. */
  appliesToAll: boolean;
  sessionIds: string[];
  /** Hidden ticket, unlocked by an access code (private/VIP). */
  hidden: boolean;
  accessCode: string;
  /** «دربستی»: one order of ≥ `buyoutMin` tickets books out the whole type. */
  buyout: boolean;
  buyoutMin: string;
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
    venueName: string;
    city: string;
    address: string;
    onlineUrl: string;
    /** Dropped pin coordinates (null until the organizer places one). */
    lat: number | null;
    lng: number | null;
  };
  visibility: Visibility;
  requireApproval: boolean;
  /** Access code for `private` events. */
  accessCode: string;
  /** Optional custom ticket appearance; `null` uses the default design. */
  ticketDesign: TicketTemplate | null;
  scheduleMode: ScheduleMode;
  sessions: SessionDraft[];
  recurrence: RecurrenceDraft;
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
    showSeat: false,
    showDate: true,
    showVenue: true,
    note: "این بلیت را هنگام ورود ارائه دهید.",
  };
}

export function emptySession(id: string): SessionDraft {
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
    salesStart: "",
    salesEnd: "",
    appliesToAll: true,
    sessionIds: [],
    hidden: false,
    accessCode: "",
    buyout: false,
    buyoutMin: "",
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
    venueName: "",
    city: "",
    address: "",
    onlineUrl: "",
    lat: null,
    lng: null,
  },
  visibility: "public",
  requireApproval: false,
  accessCode: "",
  ticketDesign: null,
  scheduleMode: "single",
  sessions: [emptySession("session-1")],
  recurrence: { frequency: "weekly", interval: "1", byDay: [], count: "8" },
  ticketTypes: [{ ...emptyTicket("ticket-1"), name: "بلیت عمومی" }],
};

/** Shift a `YYYY-MM-DD` date by `n` occurrences of the recurrence frequency. */
function shiftDate(date: string, n: number, rec: RecurrenceDraft): string {
  const interval = Math.max(Number.parseInt(rec.interval, 10) || 1, 1);
  const d = new Date(`${date}T00:00:00Z`);
  if (rec.frequency === "daily") d.setUTCDate(d.getUTCDate() + n * interval);
  else if (rec.frequency === "weekly") d.setUTCDate(d.getUTCDate() + n * interval * 7);
  else if (rec.frequency === "monthly") d.setUTCMonth(d.getUTCMonth() + n * interval);
  else d.setUTCDate(d.getUTCDate() + n); // weekday: daily step (approximation)
  return d.toISOString().slice(0, 10);
}

/**
 * Resolve the draft's schedule into concrete sessions.
 * - `single` / `multi`: the explicit dated sessions.
 * - `recurring`: repeats the *whole* set of base سانس‌ها (which may be more than
 *   one showtime per occurrence) across `count` occurrences.
 * Client preview and submit share this.
 */
export function expandSessions(draft: CreateDraft): SessionDraft[] {
  if (draft.scheduleMode !== "recurring") {
    return draft.sessions.filter((s) => s.date);
  }
  const bases = draft.sessions.filter((s) => s.date);
  if (bases.length === 0) return [];
  const count = Math.min(Math.max(Number.parseInt(draft.recurrence.count, 10) || 1, 1), 60);
  const out: SessionDraft[] = [];
  for (let i = 0; i < count; i++) {
    for (const base of bases) {
      out.push({
        id: `${base.id}-r${i}`,
        date: shiftDate(base.date, i, draft.recurrence),
        startTime: base.startTime,
        endTime: base.endTime,
      });
    }
  }
  return out;
}
