/**
 * Pure helpers for a seat selection that spans sections.
 *
 * The picker keeps picks and their hold deadlines keyed by section, because
 * `holdSeats` stamps `now + 20 minutes` at the moment of *each* acquisition:
 * seats taken ten minutes apart expire ten minutes apart. Deciding which
 * deadline to show, and which seats a passing deadline actually took, is fiddly
 * enough to be worth testing without a DOM.
 */

export interface Pick {
  index: number;
  section: string;
}

/**
 * The soonest any held seat lapses.
 *
 * The **earliest**, not the latest. That is the moment the buyer starts losing
 * seats, and a countdown that reassures someone right up until their booking
 * silently shrinks is worse than showing none.
 *
 * Sections with no picks are ignored: a stale deadline left behind by seats
 * that were already released would end the countdown early.
 */
export function earliestDeadline<T>(
  picks: Record<string, T[]>,
  expiries: Record<string, string>,
): string | null {
  const live = Object.entries(expiries)
    .filter(([section]) => (picks[section]?.length ?? 0) > 0)
    .map(([, at]) => at)
    .filter((at) => !Number.isNaN(Date.parse(at)))
    // ISO 8601 in UTC sorts lexicographically, which is why these are strings
    // all the way through rather than being parsed and re-formatted.
    .sort();
  return live[0] ?? null;
}

/** Sections whose hold has lapsed as of `now`. */
export function lapsedSections(
  expiries: Record<string, string>,
  now: number,
): string[] {
  return Object.keys(expiries).filter((section) => {
    const at = Date.parse(expiries[section]);
    return !Number.isNaN(at) && at <= now;
  });
}

/**
 * Drop the lapsed sections, keeping everything still held.
 *
 * Returns whether anything survived, because the message differs: losing some
 * seats and losing all of them are different things to be told.
 */
export function dropLapsed<T>(
  picks: Record<string, T[]>,
  expiries: Record<string, string>,
  now: number,
): {
  picks: Record<string, T[]>;
  expiries: Record<string, string>;
  lapsed: string[];
  partial: boolean;
} {
  const lapsed = lapsedSections(expiries, now);
  const nextPicks = { ...picks };
  const nextExpiries = { ...expiries };
  for (const section of lapsed) {
    delete nextPicks[section];
    delete nextExpiries[section];
  }
  return {
    picks: nextPicks,
    expiries: nextExpiries,
    lapsed,
    partial:
      lapsed.length > 0 &&
      Object.values(nextPicks).some((list) => list.length > 0),
  };
}

/**
 * Does this order refusal invalidate what the map is showing?
 *
 * Only two codes mean "your seats are not yours": the hold lapsed, or another
 * buyer won a specific seat. Everything else — a missing name, a bad phone, a
 * dead discount code, a closed سانس — leaves the selection perfectly valid, and
 * clearing the map for those would throw away seats the buyer still holds while
 * they fix a typo.
 *
 * A predicate rather than an inline `||` in the submit handler because it is a
 * decision with consequences in both directions, and one that no test could
 * reach while it lived inside a click handler that needs a server to run.
 *
 * Deliberately closed: an unrecognised code does *not* trigger a resync. New
 * error codes get added to `ErrorCode` regularly, and defaulting to "throw the
 * selection away" would make every future addition quietly destructive.
 */
export function needsSeatResync(code: unknown): boolean {
  return code === "HOLD_EXPIRED" || code === "SEAT_TAKEN";
}
