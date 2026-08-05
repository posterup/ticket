/** Persian (Jalali) display formatting for stored Gregorian ISO values. */

/**
 * Every time in this product is venue time, and every venue is in Iran.
 *
 * Without pinning this, `toLocaleTimeString` renders in *the viewer's* zone: an
 * organiser in Tehran typed 18:00, the wizard stored it, and the page showed
 * ۲۱:۳۰ back to them. Worse for date-only values written as `T00:00:00.000Z`,
 * which render as the *previous day* for any viewer west of UTC.
 *
 * Iran abolished daylight saving in 2022, so this is a fixed +03:30 — but the
 * IANA name is used rather than the offset so a future change is the tz
 * database's problem and not ours.
 */
export const VENUE_TIME_ZONE = "Asia/Tehran";

export function formatJalaliDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: VENUE_TIME_ZONE,
  });
}

/**
 * A wall-clock string the user typed — `"18:00"` — in Persian digits.
 *
 * Deliberately not a `Date`. A time with no date is not an instant, and the
 * only way to make one is to invent a date: the create wizard used
 * `1970-01-01T18:00:00.000Z`, which is a real moment in 1970 and renders as
 * ۲۱:۳۰ in Tehran. The organiser typed 18:00 and the live preview showed them
 * half past nine.
 *
 * Returns the input unchanged if it is not `HH:MM`, so a partially typed field
 * does not become "NaN".
 */
export function formatClock(hhmm: string): string {
  if (!/^\d{1,2}:\d{2}$/.test(hhmm)) return hhmm;
  return hhmm.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

/**
 * The venue's wall clock, split into the two fields a form edits.
 *
 * Slicing the ISO string instead — `startAt.slice(11, 16)`, as the session
 * editor did — yields **UTC**: a session at 18:00 Tehran populated its own edit
 * form as `14:30` while the row directly above it read «۱۸:۰۰». Nothing
 * corrupted on its own, because the same slice was written back; the damage
 * came from an organiser "correcting" 14:30 to the 18:00 they meant and pushing
 * the session to 21:30.
 */
export function venueParts(iso: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VENUE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const at = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  // Some ICU builds render midnight as "24" under hour12: false.
  const hour = at("hour") === "24" ? "00" : at("hour");
  return {
    date: `${at("year")}-${at("month")}-${at("day")}`,
    time: `${hour}:${at("minute")}`,
  };
}

/**
 * A date and a wall-clock time, as typed for the venue, as an instant.
 *
 * The offset is *derived*, not hardcoded: guess the instant as if the wall
 * clock were UTC, ask `venueParts` what Tehran actually shows then, and correct
 * by the difference. Iran has had no DST since 2022, so a literal `+03:30`
 * would be right today — but this stays right if that changes, and it reads
 * from the same Intl data every other formatter here uses.
 */
export function venueIso(date: string, time: string): string {
  const guess = new Date(`${date}T${time || "00:00"}:00Z`);
  if (Number.isNaN(guess.getTime())) return new Date().toISOString();
  const shown = venueParts(guess.toISOString());
  const drift = Date.parse(`${shown.date}T${shown.time}:00Z`) - guess.getTime();
  return new Date(guess.getTime() - drift).toISOString();
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: VENUE_TIME_ZONE,
  });
}

/**
 * Format an integer count/amount with Persian digits and grouping.
 *
 * Guards non-finite input (undefined/null/NaN) by returning "" instead of
 * throwing — `undefined.toLocaleString()` was a real crash.
 */
export function formatNumber(
  n?: number | null,
  /**
   * Cap the decimals, for the rare value that has any.
   *
   * Almost everything here is an integer — a count, a Toman amount — so this is
   * absent by default. It exists because `toFixed()` produces an ASCII string
   * with an ASCII `.`, which is how «نسبت کنتراست 3.8 از ۴٫۵ لازم» came to put
   * two numeral systems and two decimal separators inside one comparison. The
   * locale knows that «٫» is the Persian separator; `toFixed` does not.
   */
  maximumFractionDigits?: number,
): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "";
  return n.toLocaleString(
    "fa-IR",
    maximumFractionDigits === undefined ? undefined : { maximumFractionDigits },
  );
}

/**
 * Persian digits inside an arbitrary string, leaving everything else alone.
 *
 * `formatNumber` takes a `number`, which is why seat labels escaped it: a row
 * is «الف» or `A` or `3` depending on the layout's `rowScheme`, so there is
 * nothing to pass. `lib/venues/numbering.ts` states the contract exactly —
 * labels are stored ASCII so sorting, search and door-scanning keep working on
 * the stored value, and Persian digits are "applied with `formatNumber()` at
 * the edge". The edge never applied it.
 */
export function faDigits(text: string): string {
  return text.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

/**
 * The other direction: what a Persian keyboard types, as ASCII.
 *
 * The counterpart to {@link faDigits}, and the one that was missing at the
 * edges. `\D` matches «۰»–«۹» — they are not ASCII digits — so
 * `"۰۹۱۲۳۴۵۶۷۸۹".replace(/\D/g, "")` returns the empty string. Every input
 * that sanitised itself that way silently discarded Persian numerals, which on
 * a Persian-first product meant the sign-in code field rejected the digits
 * printed in the user's own SMS and gave no reason.
 *
 * Arabic-Indic («٠»–«٩») is folded too: iOS Arabic keyboards emit that range,
 * and a phone number typed on one is the same phone number.
 *
 * Normalise at the edge, then validate. Never validate the raw value.
 */
export function toAsciiDigits(text: string): string {
  return text
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/**
 * A seat, written out once.
 *
 * Five places spelled this sentence themselves — the wallet card, the ticket,
 * the order page, the calendar entry and the confirmation SMS — and that is why
 * they drifted apart. `orders/[code]/page.tsx` showed it best: «بلیت ۱» in
 * Persian on one line and «صندلی 12» in ASCII five lines below it, in the same
 * card, because one went through `formatNumber` and the other went through
 * nothing.
 */
export function formatSeat(seat: {
  section: string;
  row: string;
  number: string;
}): string {
  return `${seat.section} · ردیف ${faDigits(seat.row)} · صندلی ${faDigits(seat.number)}`;
}

/**
 * How near an event is, in words — «امروز», «فردا», «۳ روز دیگر».
 *
 * A wallet full of «۲۳ مرداد ۱۴۰۵ · ساعت ۱۸:۳۰» makes the reader do the
 * arithmetic that matters most: is this today? A ticket for tonight and one for
 * September look identical apart from their position in the list.
 *
 * Counted in **calendar days at the venue**, not in elapsed hours. A show at
 * 23:00 tonight and one at 00:30 tomorrow are four and a half hours apart and
 * belong on different days; anything dividing by 86,400,000 calls them both
 * "today" or both "tomorrow" depending on when you look. `venueParts` already
 * answers "what date is it there", which is the only question this needs.
 *
 * Returns `undefined` past a week and for anything already started — the wallet
 * dims past tickets, and «۸۳ روز دیگر» is noise dressed as information.
 */
export function relativeDay(iso: string, now: Date = new Date()): string | undefined {
  // Before `venueParts`, not after: `Intl.DateTimeFormat.formatToParts` throws
  // «Invalid time value» on an unparseable date rather than returning
  // something checkable, and this value arrives from the wire. A guard placed
  // after the call is a guard that never runs — and the throw takes the whole
  // wallet down with it, over one bad `startAt`.
  if (Number.isNaN(new Date(iso).getTime())) return undefined;

  const day = (d: string) => Date.parse(`${d}T00:00:00Z`);
  const target = day(venueParts(iso).date);
  const today = day(venueParts(now.toISOString()).date);
  if (Number.isNaN(target) || Number.isNaN(today)) return undefined;

  const days = Math.round((target - today) / 86_400_000);
  if (days < 0 || days > 7) return undefined;
  if (days === 0) return "امروز";
  if (days === 1) return "فردا";
  if (days === 2) return "پس‌فردا";
  return `${formatNumber(days)} روز دیگر`;
}

/** Format a Toman price; `0` renders as «رایگان» (free). */
export function formatToman(n: number): string {
  return n === 0 ? "رایگان" : `${formatNumber(n)} تومان`;
}
