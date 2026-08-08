"use client";

import { I18nProvider } from "@heroui/react";

/**
 * Pins every HeroUI control to Persian, with Latin digits **inside inputs**.
 *
 * HeroUI is React Aria underneath, and React Aria takes its locale from the
 * *browser*, not from `<html lang="fa">`. Without this, the same `TimeField`
 * renders «۱۸:۳۰» for a reader whose Chrome is Persian and `6:30 PM` for one
 * whose Chrome is English — on a product where the clock is 24-hour and every
 * numeral is Persian. The document already declares its language; this makes
 * the widgets agree with it.
 *
 * **`-u-nu-latn` is the deliberate part, and it is a concession.** Plain
 * `fa-IR` implies the `arabext` numbering system, and React Aria's time
 * *segments* accept only digits of the active system: with it, typing `1830`
 * on a Latin numpad does nothing at all — no error, no feedback, the segments
 * simply stay `––`. Switching an Iranian phone keyboard to its English layout
 * mid-form is completely ordinary, so that is a field that silently ignores
 * half its users. Latin digits inside the two fields buys entry from either
 * keyboard.
 *
 * The Persian-first rule is not weakened by this, because it applies where
 * numerals are *read*: chips, the live preview, prices, counts and dates all
 * render through `formatClock` / `formatNumber` / `faDigits` in `lib/format.ts`,
 * which know nothing about this locale and stay Persian. The seam is only
 * between a value being edited and the same value being displayed.
 *
 * Deliberately **not** `-u-ca-persian`. That extension would switch React
 * Aria's *calendar* to Jalali too, which is right in principle but is a change
 * to date entry, and date entry still runs through `react-multi-date-picker`.
 * Add it when the calendar migrates, not before.
 */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  return <I18nProvider locale="fa-IR-u-nu-latn">{children}</I18nProvider>;
}
