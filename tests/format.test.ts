import { describe, it, expect } from "vitest";

import { faDigits, formatJalaliDate, formatNumber, formatSeat, formatTime, formatToman, relativeDay, toAsciiDigits } from "@/lib/format";

describe("formatNumber", () => {
  it("renders Persian digits", () => {
    expect(formatNumber(0)).toBe("۰");
    expect(formatNumber(1234)).toContain("۱");
  });
});

describe("formatToman", () => {
  it("includes the تومان unit", () => {
    expect(formatToman(500000)).toContain("تومان");
  });
});

describe("formatJalaliDate", () => {
  it("converts a Gregorian ISO date to a Jalali label", () => {
    // 2026-08-14 → 23 Mordad 1405
    const label = formatJalaliDate("2026-08-14T18:30:00.000Z");
    expect(label).toContain("مرداد");
    expect(label).toContain("۱۴۰۵");
  });
});

describe("formatTime", () => {
  it("renders a 24h time", () => {
    expect(formatTime("1970-01-01T18:30:00.000Z")).toMatch(/[۰-۹]/);
  });
});

/**
 * Seat labels, which escaped the Persian-numeral rule entirely.
 *
 * `lib/venues/numbering.ts` stores labels ASCII on purpose — sorting, search and
 * door-scanning all key on the stored value — and says Persian digits are
 * "applied with `formatNumber()` at the edge". No edge applied it, because
 * `formatNumber` takes a `number` and a row label is «الف» or `A` or `3`.
 */
describe("faDigits", () => {
  it("converts digits and leaves letters alone", () => {
    expect(faDigits("12")).toBe("۱۲");
    expect(faDigits("A")).toBe("A");
    expect(faDigits("الف")).toBe("الف");
    // A numeric rowScheme produces bare digits; a latin one can produce both.
    expect(faDigits("AA12")).toBe("AA۱۲");
  });

  it("is a no-op on text with no digits, and on empty input", () => {
    expect(faDigits("")).toBe("");
    expect(faDigits("بالکن شرقی")).toBe("بالکن شرقی");
  });

  it("does not touch Persian digits that are already there", () => {
    expect(faDigits("۱۲")).toBe("۱۲");
  });
});

describe("formatSeat", () => {
  it("renders every part in Persian digits", () => {
    expect(formatSeat({ section: "بالکن", row: "الف", number: "12" })).toBe(
      "بالکن · ردیف الف · صندلی ۱۲",
    );
  });

  it("handles a numeric row scheme, where both parts are digits", () => {
    expect(formatSeat({ section: "جایگاه ۳", row: "7", number: "104" })).toBe(
      "جایگاه ۳ · ردیف ۷ · صندلی ۱۰۴",
    );
  });

  it("keeps a latin row letter as a letter", () => {
    // Row schemes are authored per venue; `latin` is the default.
    expect(formatSeat({ section: "Stalls", row: "B", number: "3" })).toBe(
      "Stalls · ردیف B · صندلی ۳",
    );
  });
});

describe("formatNumber with decimals", () => {
  it("uses the Persian decimal separator, not a dot", () => {
    // `toFixed(1)` gives "3.8" — ASCII digits and an ASCII separator — which is
    // how the contrast warning came to read «نسبت کنتراست 3.8 از ۴٫۵ لازم»,
    // two numeral systems inside one comparison.
    expect(formatNumber(3.8, 1)).toBe("۳٫۸");
    expect(formatNumber(3.83, 1)).toBe("۳٫۸");
    expect(formatNumber(12.05, 1)).toBe("۱۲٫۱");
  });

  it("leaves the integer path exactly as it was", () => {
    // Every existing caller passes one argument; none may change behaviour.
    expect(formatNumber(1200)).toBe("۱٬۲۰۰");
    expect(formatNumber(0)).toBe("۰");
    expect(formatNumber(undefined)).toBe("");
    expect(formatNumber(null)).toBe("");
    expect(formatNumber(Number.NaN)).toBe("");
  });

  it("drops decimals entirely when asked for none", () => {
    expect(formatNumber(4.6, 0)).toBe("۵");
  });
});

/**
 * "Is this today?" — the question a ticket wallet exists to answer.
 *
 * Counted in calendar days **at the venue**, never in elapsed hours. A show at
 * 23:59 and one at 00:00 are a minute apart and belong on different days;
 * dividing a millisecond difference by 86,400,000 calls them the same day or
 * different ones depending on what time you happen to look.
 */
describe("relativeDay", () => {
  // 12:30 in Tehran.
  const now = new Date("2026-08-14T09:00:00Z");

  it("names the next few days", () => {
    expect(relativeDay("2026-08-14T18:30:00Z", now)).toBe("امروز");
    expect(relativeDay("2026-08-15T18:30:00Z", now)).toBe("فردا");
    expect(relativeDay("2026-08-16T18:30:00Z", now)).toBe("پس‌فردا");
    expect(relativeDay("2026-08-17T18:30:00Z", now)).toBe("۳ روز دیگر");
  });

  it("switches at midnight in Tehran, not at midnight in UTC", () => {
    // 20:29Z is 23:59 there; 20:30Z is 00:00 the next day. Four and a half
    // hours before UTC would agree.
    expect(relativeDay("2026-08-14T20:29:00Z", now)).toBe("امروز");
    expect(relativeDay("2026-08-14T20:30:00Z", now)).toBe("فردا");
  });

  it("counts days even when the clock times run backwards", () => {
    // Tomorrow at 09:00 is *less* than 24 hours after now at 12:30, and is
    // still tomorrow. An elapsed-hours implementation says today.
    expect(relativeDay("2026-08-15T05:30:00Z", now)).toBe("فردا");
  });

  it("says nothing about the far future or the past", () => {
    // The wallet dims what has been; «۸۳ روز دیگر» is noise dressed as info.
    expect(relativeDay("2026-08-22T18:30:00Z", now)).toBeUndefined();
    expect(relativeDay("2026-08-13T18:30:00Z", now)).toBeUndefined();
  });

  it("holds the boundary at exactly a week", () => {
    expect(relativeDay("2026-08-21T18:30:00Z", now)).toBe("۷ روز دیگر");
    expect(relativeDay("2026-08-22T00:00:00Z", now)).toBeUndefined();
  });

  it("returns nothing rather than NaN for an unparseable date", () => {
    expect(relativeDay("not a date", now)).toBeUndefined();
  });
});

/**
 * `\D` matches «۰»–«۹». They are not ASCII digits, so an input that sanitised
 * itself with `.replace(/\D/g, "")` discarded every Persian numeral — the
 * sign-in code field rejected the digits printed in the user's own SMS and gave
 * no reason, on a product whose brand commitment is that Persian is not a
 * localisation layer.
 */
describe("toAsciiDigits", () => {
  it("folds Persian digits, which \\D deletes outright", () => {
    // The bug, pinned: this is what every affected input was doing.
    expect("۰۹۱۲۳۴۵۶۷۸۹".replace(/\D/g, "")).toBe("");
    expect(toAsciiDigits("۰۹۱۲۳۴۵۶۷۸۹")).toBe("09123456789");
    expect(toAsciiDigits("۱۲۳۴۵۶").replace(/\D/g, "")).toBe("123456");
  });

  it("folds Arabic-Indic digits, which iOS Arabic keyboards emit", () => {
    expect(toAsciiDigits("٠٩١٢٣٤٥٦٧٨٩")).toBe("09123456789");
  });

  it("leaves ASCII digits and surrounding text alone", () => {
    expect(toAsciiDigits("09123456789")).toBe("09123456789");
    expect(toAsciiDigits("کد: ۱۲۳")).toBe("کد: 123");
  });

  it("round-trips with faDigits", () => {
    expect(toAsciiDigits(faDigits("2026"))).toBe("2026");
  });
});
