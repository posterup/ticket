import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  extractFlight,
  extractOgTitle,
  extractPageProps,
  parseFidibo,
  parseSitemap,
} from "@/lib/scraper/sources/fidibo";
import { tehranDayString, tehranParts } from "@/lib/scraper/dates";
import type { DiscoveredRef } from "@/lib/scraper/types";

const html = readFileSync(
  join(__dirname, "fixtures", "fidibo-event.html"),
  "utf8",
);

const ref: DiscoveredRef = {
  sourceEventId: "47",
  url: "https://art.fidibo.com/theater/تاوان-47",
  listing: {},
};

describe("parseSitemap", () => {
  it("extracts detail refs with ids, skipping listing pages", () => {
    const xml = `<?xml version="1.0"?><urlset>
      <url><loc>https://art.fidibo.com</loc></url>
      <url><loc>https://art.fidibo.com/theater</loc></url>
      <url><loc>https://art.fidibo.com/theater/تاوان-47</loc><lastmod>2026-08-07T08:30:00.000Z</lastmod></url>
      <url><loc>https://art.fidibo.com/academy/%DA%A9%D8%A7%D8%B1%DA%AF%D8%A7%D9%87-131</loc></url>
      <url><loc>https://art.fidibo.com/faq</loc></url>
    </urlset>`;
    const refs = parseSitemap(xml);
    expect(refs.map((r) => r.sourceEventId)).toEqual(["47", "131"]);
    expect(refs[0].listing.lastmod).toBe("2026-08-07T08:30:00.000Z");
  });
});

describe("RSC payload extraction", () => {
  it("reassembles the flight stream and finds eventInfo + sessions", () => {
    expect(extractFlight(html).length).toBeGreaterThan(10_000);
    const props = extractPageProps(html);
    expect(props?.eventInfo?.title).toBe("تاوان");
    expect(props?.eventInfo?.status).toBe("published");
    expect(props?.eventInfo?.location_info?.venue_name).toContain("شهرزاد");
    expect(props?.sessions?.length).toBeGreaterThan(5);
  });

  it("reads the OG title", () => {
    expect(extractOgTitle(html)).toBe("تاوان");
  });
});

describe("parseFidibo", () => {
  it("parses the real captured page", () => {
    const { event, weekdayMismatches } = parseFidibo(ref, html);
    expect(weekdayMismatches).toBe(0);
    expect(event).not.toBeNull();
    expect(event!.title).toBe("تاوان");
    expect(event!.categories).toEqual(["theater"]);
    expect(event!.venueName).toContain("پردیس تئاتر");
    expect(event!.posterUrl).toContain("cdn.fidibo.com");
    expect(event!.city).toBeNull(); // source names no city — never invented
    expect(event!.price.min).toBeNull(); // prices not in payload — never invented
    expect(event!.sessions.length).toBeGreaterThan(5);
  });

  it("resolves year-less Jalali sessions to real dates with times", () => {
    const { event } = parseFidibo(ref, html);
    // Session id 980: day=18 مرداد, یک‌شنبه, 19:15, hint 2026-08-03 → Aug 9.
    const aug9 = event!.sessions.find(
      (s) => tehranDayString(s.startAt) === "2026-08-09",
    );
    expect(aug9).toBeDefined();
    expect(tehranParts(aug9!.startAt)).toMatchObject({ hour: 19, minute: 15 });
    // 70-minute duration tag → source-stated end, not an invented one.
    expect(aug9!.endAt!.getTime() - aug9!.startAt.getTime()).toBe(70 * 60_000);
    expect(aug9!.dateOnly).toBe(false);
  });

  it("carries per-session source status for lifecycle", () => {
    const { event } = parseFidibo(ref, html);
    const statuses = new Set(event!.sessions.map((s) => s.sourceStatus));
    expect(statuses.has("finished")).toBe(true);
    expect(statuses.has("live")).toBe(true);
  });

  it("skips pages without a payload", () => {
    const r = parseFidibo(ref, "<html><body>nope</body></html>");
    expect(r.event).toBeNull();
    expect(r.skip).toBe("no-payload");
  });
});
