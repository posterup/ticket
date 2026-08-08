import { describe, expect, it } from "vitest";

import {
  canonicalUrl,
  cleanText,
  digitsToAscii,
  foldForMatch,
  parsePrice,
} from "@/lib/scraper/normalize";

describe("cleanText", () => {
  it("unifies Arabic letterforms to Persian", () => {
    expect(cleanText("موسيقي")).toBe("موسیقی");
    expect(cleanText("كتاب")).toBe("کتاب");
  });

  it("strips tags and decodes entities", () => {
    expect(cleanText("<p>سلام&nbsp;&amp; درود</p>")).toBe("سلام & درود");
    expect(cleanText("&#1740;&#x06A9;")).toBe("یک");
  });

  it("keeps ZWNJ but drops other zero-width characters", () => {
    expect(cleanText("می‌روم")).toBe("می‌روم"); // ZWNJ survives
    expect(cleanText("a​b﻿c")).toBe("abc");
  });

  it("keeps Persian numerals for storage", () => {
    expect(cleanText("ساعت ۲۰:۳۰")).toBe("ساعت ۲۰:۳۰");
  });

  it("collapses whitespace", () => {
    expect(cleanText("  الف   ب\n\tج ")).toBe("الف ب ج");
  });
});

describe("foldForMatch", () => {
  it("folds digits, ZWNJ, and punctuation for comparison", () => {
    expect(foldForMatch("نمایشِ «شازده کوچولو» — ۲")).toBe(
      "نمایش شازده کوچولو 2",
    );
    expect(foldForMatch("می‌روم")).toBe(foldForMatch("میروم"));
  });
});

describe("digitsToAscii", () => {
  it("converts Persian and Arabic digits and separators", () => {
    expect(digitsToAscii("۱۰۰٬۰۰۰")).toBe("100,000");
    expect(digitsToAscii("٥٤٣")).toBe("543");
  });
});

describe("parsePrice", () => {
  it("parses plain Toman", () => {
    const p = parsePrice("100,000 تومان");
    expect(p).toMatchObject({ min: 100_000, max: 100_000, currency: "تومان", isFree: false });
  });

  it("parses Persian-digit Toman", () => {
    const p = parsePrice("۱۰۰٬۰۰۰ تومان");
    expect(p).toMatchObject({ min: 100_000, max: 100_000, currency: "تومان" });
  });

  it("keeps Rial as Rial — never converts", () => {
    const p = parsePrice("100000 ریال");
    expect(p).toMatchObject({ min: 100_000, max: 100_000, currency: "ریال" });
  });

  it("handles «از X هزار تومان» as an open-ended minimum", () => {
    const p = parsePrice("از 150 هزار تومان");
    expect(p).toMatchObject({ min: 150_000, max: null, currency: "تومان" });
  });

  it("handles free", () => {
    expect(parsePrice("رایگان")).toMatchObject({ min: 0, max: 0, isFree: true });
  });

  it("handles ranges with a shared elided unit", () => {
    const p = parsePrice("۲۰۰ تا ۴۵۰ هزار تومان");
    expect(p.min).toBe(200_000);
    expect(p.max).toBe(450_000);
  });

  it("ignores phone numbers and other non-price digits", () => {
    // Live regression: a reservation phone number overflowed the Int column.
    const p = parsePrice("رزرو: 09379540594");
    expect(p).toMatchObject({ min: null, max: null, currency: null });
    const q = parsePrice("ورودی ۱۵۰ هزار تومان — رزرو ۰۹۱۲۳۴۵۶۷۸۹");
    expect(q.min).toBe(150_000);
    expect(q.max).toBe(150_000);
  });

  it("ignores dates, times, and capacities in mixed text", () => {
    const p = parsePrice("تاریخ ۱۴۰۵/۰۵/۱۸ ساعت ۱۸:۳۰ ظرفیت ۳۰ نفر ورودی ۲۰۰ هزار تومان");
    expect(p.min).toBe(200_000);
    expect(p.max).toBe(200_000);
  });

  it("refuses to invent numbers from contact-the-organizer text", () => {
    const p = parsePrice("به دایرکت برگزارکننده مراجعه فرمایید.");
    expect(p).toMatchObject({ min: null, max: null, currency: null, isFree: null });
    expect(p.text).toContain("دایرکت");
  });

  it("treats a bare number with no currency or multiplier as not-a-price", () => {
    const p = parsePrice("۵۰۰");
    expect(p).toMatchObject({ min: null, max: null, currency: null });
  });
});

describe("canonicalUrl", () => {
  it("strips tracking params, hash, and trailing slash", () => {
    expect(
      canonicalUrl("https://Example.com/a/?utm_source=x&keep=1#frag"),
    ).toBe("https://example.com/a?keep=1");
  });
});
