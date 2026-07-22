import type { Event } from "@/types";

/** The session date an event is placed at on a timeline (its earliest). */
export function eventStart(event: Event): string {
  const starts = event.sessions.map((s) => s.startAt);
  return starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : event.createdAt;
}

/** Jalali «month year» label used to group events into timeline sections. */
export function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
  });
}

export interface EventGroup {
  key: string;
  label: string;
  items: Array<{ event: Event; start: string }>;
}

/** Group events by month, chronologically (earliest first). */
export function groupEventsByMonth(events: Event[]): EventGroup[] {
  const withStart = events
    .map((event) => ({ event, start: eventStart(event) }))
    .sort((a, b) => a.start.localeCompare(b.start));

  const groups: EventGroup[] = [];
  for (const item of withStart) {
    const label = monthLabel(item.start);
    let group = groups.find((g) => g.key === label);
    if (!group) {
      group = { key: label, label, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}
