/**
 * Client-side state for the event composer (the redesigned create flow).
 *
 * Design goals (agreed with product): a sessions-first schedule model (an event
 * owns one or more sessions / سانس), flexible ticket kinds, and per-event
 * visibility. All string fields are kept as strings for the inputs and parsed
 * on submit.
 */

import type { RecurrenceFrequency, WeekDay } from "@/types";

export type LocationMode = "in-person" | "online" | "hybrid";
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
  description: string;
}

export interface CreateDraft {
  title: string;
  description: string;
  /** Discovery category label (also used as the primary tag). */
  category: string;
  location: {
    mode: LocationMode;
    venueName: string;
    city: string;
    address: string;
    onlineUrl: string;
  };
  visibility: Visibility;
  requireApproval: boolean;
  /** Access code for `private` events. */
  accessCode: string;
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
  category: "موسیقی",
  location: {
    mode: "in-person",
    venueName: "",
    city: "",
    address: "",
    onlineUrl: "",
  },
  visibility: "public",
  requireApproval: false,
  accessCode: "",
  scheduleMode: "single",
  sessions: [emptySession("session-1")],
  recurrence: { frequency: "weekly", interval: "1", byDay: [], count: "8" },
  ticketTypes: [{ ...emptyTicket("ticket-1"), name: "بلیت عمومی" }],
};

/**
 * Resolve the draft's schedule into concrete sessions. `single`/`multi` return
 * their explicit sessions; `recurring` expands the first session across the
 * recurrence rule (client-side preview + submit share this).
 */
export function expandSessions(draft: CreateDraft): SessionDraft[] {
  if (draft.scheduleMode !== "recurring") {
    return draft.sessions.filter((s) => s.date);
  }
  const base = draft.sessions[0];
  if (!base?.date) return [];
  const count = Math.min(Math.max(Number.parseInt(draft.recurrence.count, 10) || 1, 1), 60);
  const interval = Math.max(Number.parseInt(draft.recurrence.interval, 10) || 1, 1);
  const start = new Date(`${base.date}T00:00:00Z`);
  const out: SessionDraft[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    if (draft.recurrence.frequency === "daily") d.setUTCDate(d.getUTCDate() + i * interval);
    else if (draft.recurrence.frequency === "weekly") d.setUTCDate(d.getUTCDate() + i * interval * 7);
    else if (draft.recurrence.frequency === "monthly") d.setUTCMonth(d.getUTCMonth() + i * interval);
    else d.setUTCDate(d.getUTCDate() + i); // weekday: daily step (approximation)
    out.push({
      id: `${base.id}-r${i}`,
      date: d.toISOString().slice(0, 10),
      startTime: base.startTime,
      endTime: base.endTime,
    });
  }
  return out;
}
