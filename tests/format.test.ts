import { describe, it, expect } from "vitest";

import { formatNumber, formatToman, formatJalaliDate, formatTime } from "@/lib/format";

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
