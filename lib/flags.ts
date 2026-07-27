/**
 * Product feature flags — flip an in-progress feature on only when it is ready
 * to ship. While a flag is off the feature must leave no visible trace: no UI,
 * no data, no hints that it exists.
 *
 * Flags are read from `NEXT_PUBLIC_*` env vars so the same constant resolves in
 * both server and client bundles (Next inlines them at build time). Unset = off.
 */

/**
 * Calendar (تقویمی / `recurring`) scheduling. While OFF:
 * - recurring events are filtered out of every listing ({@link listEvents}),
 * - the «زمان‌بندی تقویمی» create toggle and the dashboard recurrence editor
 *   are suppressed, and
 * - the «تقویمی» mode badge never renders ({@link modeLabel}).
 *
 * Net effect: the calendar mode is imperceptible site-wide. Enable with
 * `NEXT_PUBLIC_CALENDAR_MODE=1`.
 */
export const CALENDAR_MODE_ENABLED =
  process.env.NEXT_PUBLIC_CALENDAR_MODE === "1";
