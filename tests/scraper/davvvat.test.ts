import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  extractJsonLd,
  parseDavvvat,
  scoreVerification,
  type DavvvatDoc,
} from "@/lib/scraper/sources/davvvat";
import { tehranDayString, tehranParts } from "@/lib/scraper/dates";

const fixture = (name: string) =>
  readFileSync(join(__dirname, "fixtures", name), "utf8");

const realDoc = JSON.parse(fixture("davvvat-doc.json")) as DavvvatDoc;

describe("parseDavvvat", () => {
  it("parses the real captured doc", () => {
    const { event } = parseDavvvat(realDoc);
    expect(event).not.toBeNull();
    expect(event!.title).toBe("ورکشاپ ساخت بادی اسپلش");
    expect(event!.sourceEventId).toBe("2bde8484c1");
    expect(event!.city).toBe("تهران");
    expect(event!.externalTicketUrl).toContain("instagram.com");
    // Fake-Z: 2026-08-10T11:30 "Z" is Tehran wall time.
    const s = event!.sessions[0];
    expect(tehranDayString(s.startAt)).toBe("2026-08-10");
    expect(tehranParts(s.startAt)).toMatchObject({ hour: 11, minute: 30 });
    // startDate === endDate → no invented end.
    expect(s.endAt).toBeNull();
    // «به دایرکت…» has no digits → no invented price, text preserved.
    expect(event!.price.min).toBeNull();
    expect(event!.price.text).toContain("دایرکت");
  });

  it("skips private, draft, and undated docs with a reason", () => {
    expect(parseDavvvat({ ...realDoc, isPrivate: true }).skip).toBe("private");
    expect(parseDavvvat({ ...realDoc, status: "draft" }).skip).toBe("draft");
    expect(parseDavvvat({ ...realDoc, startDate: null }).skip).toBe("no-date");
    expect(
      parseDavvvat({
        ...realDoc,
        startDate: "2026-08-10T11:30:00.000Z",
        endDate: "2026-08-09T11:30:00.000Z",
      }).skip,
    ).toBe("end-before-start");
  });

  it("combines midnight stamps with explicit HH:mm fields (live shape)", () => {
    // Real doc shape: startDate/endDate at fake-Z midnight, times separate.
    const { event } = parseDavvvat({
      ...realDoc,
      startDate: "2026-08-08T00:00:00.000Z",
      startTime: "17:00",
      endDate: "2026-08-08T00:00:00.000Z",
      endTime: "19:00",
    });
    const s = event!.sessions[0];
    expect(tehranParts(s.startAt)).toMatchObject({ day: 8, hour: 17, minute: 0 });
    expect(tehranParts(s.endAt!)).toMatchObject({ day: 8, hour: 19, minute: 0 });
    expect(s.dateOnly).toBe(false);
  });

  it("explicit time field beats the stamp's own clock", () => {
    const { event } = parseDavvvat({
      ...realDoc,
      startDate: "2026-08-07T11:30:00.000Z",
      startTime: "16:00",
      endDate: "2026-08-18T11:30:00.000Z",
      endTime: "20:00",
    });
    const s = event!.sessions[0];
    expect(tehranParts(s.startAt)).toMatchObject({ day: 7, hour: 16 });
    expect(tehranParts(s.endAt!)).toMatchObject({ day: 18, hour: 20 });
  });

  it("start time without end time yields no invented end", () => {
    const { event } = parseDavvvat({
      ...realDoc,
      startDate: "2026-08-08T00:00:00.000Z",
      startTime: "20:00",
      endDate: "2026-08-08T00:00:00.000Z",
      endTime: null,
    });
    const s = event!.sessions[0];
    expect(tehranParts(s.startAt)).toMatchObject({ hour: 20 });
    expect(s.endAt).toBeNull();
  });

  it("an end clock before the start clock crosses midnight", () => {
    const { event } = parseDavvvat({
      ...realDoc,
      startDate: "2026-08-08T00:00:00.000Z",
      startTime: "23:00",
      endDate: "2026-08-08T00:00:00.000Z",
      endTime: "01:00",
    });
    const s = event!.sessions[0];
    expect(s.endAt!.getTime()).toBeGreaterThan(s.startAt.getTime());
    expect(tehranParts(s.endAt!)).toMatchObject({ day: 9, hour: 1 });
  });

  it("treats explicit midnight with no startTime as date-only", () => {
    const { event } = parseDavvvat({
      ...realDoc,
      startDate: "2026-08-20T00:00:00.000Z",
      endDate: "2026-08-20T00:00:00.000Z",
      startTime: null,
    });
    expect(event!.sessions[0].dateOnly).toBe(true);
  });

  it("honors the source's explicit free flag", () => {
    const { event } = parseDavvvat({
      ...realDoc,
      ticketPrice: { isFree: "free", priceText: null },
    });
    expect(event!.price.isFree).toBe(true);
    expect(event!.price.min).toBe(0);
  });
});

describe("extractJsonLd + scoring", () => {
  it("extracts the Event JSON-LD from a detail page", () => {
    const ld = extractJsonLd(fixture("davvvat-jsonld.html"));
    expect(ld?.name).toBe("ورکشاپ ساخت بادی اسپلش");
    expect(ld?.organizer?.name).toBe("گروه دچار");
    // Page startDate is Tehran-midnight-as-UTC for Aug 10.
    expect(tehranDayString(new Date(ld!.startDate!))).toBe("2026-08-10");
  });

  it("marks cross-surface disagreement as conflict, not a silent pick", () => {
    const { event } = parseDavvvat(realDoc);
    const result = scoreVerification(
      event!,
      { source: true, title: false, date: true, status: true },
      ["title differs"],
    );
    expect(result.status).toBe("conflict");
  });

  it("rejects below the quality floor", () => {
    const { event } = parseDavvvat({
      ...realDoc,
      name: "x",
      description: "",
      cover: null,
    });
    // name "x" is too short to be a valid title → parse still returns it,
    // verification rejects it.
    const result = scoreVerification(event!, {}, []);
    expect(result.status).toBe("rejected");
  });
});
