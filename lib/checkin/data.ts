/**
 * Deterministic mock ticket-holders for the check-in tool. Generated from the
 * event id + its ticket types so the list is stable across server/client
 * renders. Replace with real issued-ticket data when the datastore lands.
 */

import { listTickets } from "@/lib/server";

const NAME_POOL = [
  "سارا محمدی",
  "امیرحسین رضایی",
  "نگار کریمی",
  "محمد حسینی",
  "زهرا احمدی",
  "علی موسوی",
  "فاطمه کاظمی",
  "رضا نجفی",
  "مریم صادقی",
  "حسین علوی",
  "الهام رستمی",
  "پویا کریمی",
  "نیلوفر جعفری",
  "آرش مرادی",
  "سمیرا قاسمی",
  "بهرام شریفی",
];

export interface Holder {
  id: string;
  code: string;
  name: string;
  ticketType: string;
}

/** Build a deterministic holder list for an event (up to 14 holders). */
export function buildHolders(eventId: string, index: number): Holder[] {
  const ticketNames = listTickets(eventId).map((t) => t.name);
  const types = ticketNames.length > 0 ? ticketNames : ["عمومی"];
  const count = Math.min(14, NAME_POOL.length);
  const prefix = String.fromCharCode(65 + (index % 26)); // A, B, C…

  return Array.from({ length: count }, (_, i) => ({
    id: `${eventId}-h${i}`,
    code: `PSTR-${prefix}${(i + 1).toString().padStart(3, "0")}`,
    name: NAME_POOL[i % NAME_POOL.length],
    ticketType: types[i % types.length],
  }));
}
