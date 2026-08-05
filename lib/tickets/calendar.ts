/**
 * An issued ticket as a calendar entry.
 *
 * A ticket page that only shows a QR code assumes the holder will remember to
 * come back to it. Most of the value of a ticket is delivered by the reminder
 * their phone gives them the day before, and the platform was leaving that
 * entirely to them.
 *
 * Deliberately hand-written rather than a dependency. RFC 5545 is small, and
 * the two parts that are actually easy to get wrong — escaping and the 75-octet
 * line fold — are both pure string work that can be tested without a browser,
 * a database, or a calendar client. A library would have to be trusted; this
 * can be verified.
 */

export interface CalendarEvent {
  /** Stable across regenerations for the same ticket. */
  uid: string;
  title: string;
  startAt: string;
  /** Absent for an open-ended showing; a default length is applied. */
  endAt?: string;
  location?: string;
  description?: string;
  /** When the file was produced. Injected so output is deterministic in tests. */
  stamp?: Date;
}

/** Applied when a showing has no end time. */
const DEFAULT_DURATION_MINUTES = 120;

/**
 * `20261205T183000Z`.
 *
 * Everything is emitted in UTC. A floating local time would be interpreted in
 * the *reader's* zone, so a Tehran showing would land three and a half hours
 * out for anyone whose phone is set elsewhere — which includes most people
 * travelling to it.
 */
function stampOf(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Escape a text value.
 *
 * Backslash first, or the escapes this adds get escaped again. Commas and
 * semicolons are RFC 5545 list separators — an unescaped comma in a Persian
 * venue name silently truncates the field in some clients.
 */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Fold a content line to 75 **octets**, not characters.
 *
 * The distinction is the whole point here: Persian is multi-byte in UTF-8, so a
 * 75-*character* fold produces lines well over the limit, and splitting inside
 * a multi-byte sequence corrupts the character. Continuation lines begin with a
 * single space, which the parser strips.
 */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const out: string[] = [];
  let current = "";
  let bytes = 0;
  // Limit is 75 for the first line and 74 for continuations, which carry a
  // leading space.
  let limit = 75;

  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > limit) {
      out.push(current);
      current = "";
      bytes = 0;
      limit = 74;
    }
    current += char;
    bytes += size;
  }
  if (current) out.push(current);

  return out.join("\r\n ");
}

/** One ticket as a `.ics` document. */
export function toIcs(event: CalendarEvent): string {
  const start = new Date(event.startAt);
  const end = event.endAt
    ? new Date(event.endAt)
    : new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60_000);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Poster//Ticket//FA",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${stampOf(event.stamp ?? start)}`,
    `DTSTART:${stampOf(start)}`,
    `DTEND:${stampOf(end)}`,
    `SUMMARY:${escapeText(event.title)}`,
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    ...(event.description
      ? [`DESCRIPTION:${escapeText(event.description)}`]
      : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  // CRLF throughout: RFC 5545 requires it, and Outlook rejects bare LF.
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** A filename that survives a Persian title on a Latin filesystem. */
export function icsFileName(title: string): string {
  const slug = title
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${slug || "ticket"}.ics`;
}
