/**
 * A ticket as a calendar entry.
 *
 * The two parts worth testing are the ones a calendar client will not forgive:
 * escaping, and folding by **octets** rather than characters. Persian is
 * multi-byte in UTF-8, so a fold written against `String.length` produces lines
 * over the RFC limit and can split a character in half.
 */

import { describe, it, expect } from "vitest";

import { escapeText, foldLine, icsFileName, toIcs } from "@/lib/tickets/calendar";

const STAMP = new Date("2026-07-30T09:00:00.000Z");
const base = {
  uid: "ticket-abc@poster",
  title: "کنسرت همایون شجریان",
  startAt: "2026-12-05T18:30:00.000Z",
  endAt: "2026-12-05T20:30:00.000Z",
  stamp: STAMP,
};

const bytes = (s: string) => new TextEncoder().encode(s).length;

describe("escaping", () => {
  it("escapes the RFC list separators", () => {
    // An unescaped comma silently truncates the field in some clients.
    expect(escapeText("تالار وحدت, تهران")).toBe("تالار وحدت\\, تهران");
    expect(escapeText("a;b")).toBe("a\\;b");
  });

  it("escapes backslashes before anything else", () => {
    // Escaping commas first would then escape the backslash this adds.
    expect(escapeText("a\\b,c")).toBe("a\\\\b\\,c");
  });

  it("turns newlines into the literal escape", () => {
    expect(escapeText("خط اول\nخط دوم")).toBe("خط اول\\nخط دوم");
    expect(escapeText("crlf\r\nhere")).toBe("crlf\\nhere");
  });
});

describe("line folding", () => {
  it("leaves a short line alone", () => {
    expect(foldLine("SUMMARY:کوتاه")).toBe("SUMMARY:کوتاه");
  });

  it("folds on octets, not characters", () => {
    // 60 Persian characters is 120 bytes — under a naive character limit of
    // 75, and well over the real one.
    const line = "SUMMARY:" + "ش".repeat(60);
    expect(line.length).toBeLessThan(75);
    expect(bytes(line)).toBeGreaterThan(75);

    const folded = foldLine(line);
    expect(folded).toContain("\r\n ");
    for (const part of folded.split("\r\n")) {
      expect(bytes(part)).toBeLessThanOrEqual(75);
    }
  });

  it("never splits a multi-byte character", () => {
    const folded = foldLine("DESCRIPTION:" + "بلیت".repeat(40));
    // A split inside a UTF-8 sequence shows up as a replacement character on
    // the round trip.
    const rejoined = folded.split("\r\n ").join("");
    expect(rejoined).not.toContain("�");
    expect(rejoined).toBe("DESCRIPTION:" + "بلیت".repeat(40));
  });

  it("allows for the leading space on continuation lines", () => {
    const folded = foldLine("X:" + "a".repeat(300));
    const parts = folded.split("\r\n");
    expect(bytes(parts[0])).toBeLessThanOrEqual(75);
    // Continuations carry a space that counts toward the same 75.
    for (const p of parts.slice(1)) expect(bytes(p)).toBeLessThanOrEqual(75);
  });
});

describe("the document", () => {
  it("has the envelope a client expects", () => {
    const ics = toIcs(base);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("BEGIN:VEVENT");
  });

  it("uses CRLF everywhere — Outlook rejects bare LF", () => {
    const ics = toIcs(base);
    expect(ics.split("\n").every((l) => l === "" || l.endsWith("\r"))).toBe(true);
  });

  it("emits UTC, so the time is not read in the wrong zone", () => {
    const ics = toIcs(base);
    expect(ics).toContain("DTSTART:20261205T183000Z");
    expect(ics).toContain("DTEND:20261205T203000Z");
  });

  it("gives an open-ended showing a default length", () => {
    const ics = toIcs({ ...base, endAt: undefined });
    // Two hours, not a zero-length event that some clients hide entirely.
    expect(ics).toContain("DTSTART:20261205T183000Z");
    expect(ics).toContain("DTEND:20261205T203000Z");
  });

  it("omits optional fields rather than emitting them empty", () => {
    const ics = toIcs(base);
    expect(ics).not.toContain("LOCATION:");
    expect(ics).not.toContain("DESCRIPTION:");
  });

  it("carries the venue and the seat when there are any", () => {
    const ics = toIcs({
      ...base,
      location: "تالار وحدت، تهران",
      description: "ردیف C صندلی ۱۲",
    });
    // «،» is the Persian comma, not the ASCII list separator — it must pass
    // through untouched, or the venue name gains a stray backslash.
    expect(ics).toContain("LOCATION:تالار وحدت، تهران");
    expect(ics).toContain("DESCRIPTION:ردیف C صندلی ۱۲");
  });

  it("is deterministic for the same ticket", () => {
    expect(toIcs(base)).toBe(toIcs(base));
  });

  it("carries the instant, so the reminder fires at the venue's time", () => {
    // Stored values are true instants; the `.ics` emits them in UTC and the
    // phone renders them wherever its owner is. What must not happen is the
    // wizard's old behaviour — typing 18:00 and storing 18:00Z — which put
    // ۲۱:۳۰ in a Tehran calendar.
    const evening = new Date("2026-08-05T18:00:00+03:30").toISOString();
    const ics = toIcs({ ...base, startAt: evening, endAt: undefined });
    expect(ics).toContain("DTSTART:20260805T143000Z");
    expect(
      new Date(evening).toLocaleTimeString("fa-IR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Tehran",
      }),
    ).toBe("۱۸:۰۰");
  });
});

describe("filenames", () => {
  it("keeps Persian letters and drops the rest", () => {
    expect(icsFileName("کنسرت همایون شجریان")).toBe("کنسرت-همایون-شجریان.ics");
  });

  it("never produces a bare extension", () => {
    expect(icsFileName("!!!")).toBe("ticket.ics");
    expect(icsFileName("")).toBe("ticket.ics");
  });
});
