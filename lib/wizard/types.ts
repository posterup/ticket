import type {
  RecurrenceFrequency,
  TicketCategory,
  WeekDay,
} from "@/types";

/** Scheduling modes offered by the wizard (subset of EventMode). */
export type WizardMode = "one-time" | "recurring";

export interface VenueForm {
  name: string;
  city: string;
  address: string;
  /** Kept as a string for the input; parsed on submit. */
  capacity: string;
}

export interface EventInfoForm {
  title: string;
  description: string;
  venue: VenueForm;
}

export interface OneTimeForm {
  date: string;
  startTime: string;
  endTime: string;
}

export interface RecurringForm {
  frequency: RecurrenceFrequency;
  interval: string;
  byDay: WeekDay[];
  /** Date/time of the first occurrence. */
  date: string;
  startTime: string;
  endTime: string;
  /** Optional inclusive end date of the series. */
  until: string;
}

export interface TicketTypeForm {
  /** Local-only id for React keys and updates. */
  id: string;
  name: string;
  category: TicketCategory;
  /** Toman, kept as a string for the input. */
  price: string;
  capacity: string;
  salesStartDate: string;
  salesEndDate: string;
  description: string;
}

export interface WizardState {
  event: EventInfoForm;
  mode: WizardMode;
  oneTime: OneTimeForm;
  recurring: RecurringForm;
  ticketTypes: TicketTypeForm[];
}

/** A fresh, empty ticket type. `id` must be supplied by the caller. */
export function emptyTicketType(id: string): TicketTypeForm {
  return {
    id,
    name: "",
    category: "general",
    price: "",
    capacity: "",
    salesStartDate: "",
    salesEndDate: "",
    description: "",
  };
}

/**
 * Initial wizard state. The first ticket type uses a stable id so server and
 * client render identically (avoids a hydration mismatch); ids for ticket
 * types added later are generated on the client.
 */
export const initialWizardState: WizardState = {
  event: {
    title: "",
    description: "",
    venue: { name: "", city: "", address: "", capacity: "" },
  },
  mode: "one-time",
  oneTime: { date: "", startTime: "", endTime: "" },
  recurring: {
    frequency: "weekly",
    interval: "1",
    byDay: [],
    date: "",
    startTime: "",
    endTime: "",
    until: "",
  },
  ticketTypes: [emptyTicketType("ticket-1")],
};
