import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

import { resolveHolder } from "@/lib/checkin/resolve";

const holders = [
  { id: "1", code: "PSTR-A001", qrToken: "aA-_zZ09bBcC", sessionId: "s1" },
  { id: "2", code: "PSTR-A002", qrToken: "Aa-_ZZ09BbCc", sessionId: "s1" },
  { id: "3", code: "pstr-b010", qrToken: "xYz123", sessionId: "s2" },
];

describe("resolving a scanned or typed ticket", () => {
  it("matches a scanned token exactly", () => {
    expect(resolveHolder(holders, "aA-_zZ09bBcC")?.id).toBe("1");
  });

  it("keeps case, so two tokens differing only in case stay distinct", () => {
    // The whole reason the resolver exists. Upper-casing the input collapses
    // these two onto the same ticket and admits the wrong person.
    expect(resolveHolder(holders, "Aa-_ZZ09BbCc")?.id).toBe("2");
    expect(resolveHolder(holders, "aA-_zZ09bBcC")?.id).toBe("1");
  });

  it("never resolves a token typed in the wrong case", () => {
    // Better to report "not found" than to admit a different ticket.
    expect(resolveHolder(holders, "AA-_ZZ09BBCC")).toBeUndefined();
  });

  it("matches a typed order code case-insensitively", () => {
    expect(resolveHolder(holders, "pstr-a001")?.id).toBe("1");
    expect(resolveHolder(holders, "PSTR-B010")?.id).toBe("3");
  });

  it("ignores whitespace around a scan", () => {
    expect(resolveHolder(holders, "  xYz123 \n")?.id).toBe("3");
  });

  it("returns nothing for blank or unknown input", () => {
    expect(resolveHolder(holders, "   ")).toBeUndefined();
    expect(resolveHolder(holders, "NOPE")).toBeUndefined();
  });

  it("prefers a token match over a code match", () => {
    const ambiguous = [
      { id: "a", code: "SAME", qrToken: "tok-a", sessionId: "s" },
      { id: "b", code: "other", qrToken: "SAME", sessionId: "s" },
    ];
    expect(resolveHolder(ambiguous, "SAME")?.id).toBe("b");
  });
});

/**
 * The hint at the door has to describe a code that exists.
 *
 * On iOS there is no `BarcodeDetector` — and every browser on iOS is WebKit —
 * so an iPhone at a door is permanently on typed entry. The placeholder is
 * therefore not decoration: it is the only description of the format that the
 * person who has to get a queue moving will ever see.
 *
 * It read «مثلاً PSTR-A001». No such prefix exists: `trackingCode()` emits eight
 * characters from a vowel-free alphabet and `checkins.ts` appends `-{seq}`.
 */
describe("the typed-entry hint matches a real code", () => {
  const ALPHABET = "ACDEFGHJKLMNPQRTVWXYZ2346789";

  const placeholder = (): string => {
    const src = readFileSync(
      join(process.cwd(), "components/checkin/CheckinPanel.tsx"),
      "utf8",
    );
    const m = /placeholder="مثلاً ([^"]+)"/.exec(src);
    if (!m) throw new Error("check-in placeholder moved");
    return m[1];
  };

  it("shows a code the generator could actually produce", () => {
    const example = placeholder();
    const [code, seq] = example.split("-");
    expect(seq).toMatch(/^\d+$/);
    expect(code.length).toBeGreaterThanOrEqual(4);
    // Vowel-free, so a code can never spell a word — the reason the alphabet
    // is what it is. An example containing a letter outside it teaches the
    // wrong shape.
    for (const ch of code) expect(ALPHABET).toContain(ch);
  });

  it("no longer advertises a prefix that does not exist", () => {
    expect(placeholder()).not.toContain("PSTR");
  });

  it("resolves an example of that shape, given a matching holder", () => {
    // The end the hint promises: type what it shows, find the ticket.
    const example = placeholder();
    const holders = [
      { id: "x", code: example, qrToken: "tok", sessionId: "s1" },
    ];
    expect(resolveHolder(holders, example)?.id).toBe("x");
    expect(resolveHolder(holders, example.toLowerCase())?.id).toBe("x");
  });
});

/**
 * The bare order code, which is all an offline buyer has.
 *
 * The ticket pages now tell a stranded buyer to read the code out of their
 * confirmation SMS — and that SMS says «کد پیگیری: 7XN4F8R6», an *order* code.
 * Ticket codes carry a `-{seq}` that appears only on the page which, by
 * definition in that situation, will not load. Before this the door rejected
 * exactly the string it had just asked for.
 */
describe("admitting on an order code", () => {
  const party = () => [
    { id: "t1", code: "7XN4F8R6-1", qrToken: "a", sessionId: "s1" },
    { id: "t2", code: "7XN4F8R6-2", qrToken: "b", sessionId: "s1" },
    { id: "t3", code: "7XN4F8R6-3", qrToken: "c", sessionId: "s1" },
  ];

  it("resolves the code the confirmation SMS actually contains", () => {
    expect(resolveHolder(party(), "7XN4F8R6")?.id).toBe("t1");
    expect(resolveHolder(party(), "7xn4f8r6")?.id).toBe("t1");
  });

  it("walks a party through one seat at a time", () => {
    const holders = party();
    const checked = new Set<string>();
    const admitted: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const h = resolveHolder(holders, "7XN4F8R6", checked)!;
      admitted.push(h.id);
      checked.add(h.id);
    }
    expect(admitted).toEqual(["t1", "t2", "t3"]);
  });

  it("says «already admitted» rather than «not found» once they are all in", () => {
    // The difference between "you are inside" and "your ticket is not real",
    // said to someone at a door.
    const holders = party();
    const checked = new Set(["t1", "t2", "t3"]);
    expect(resolveHolder(holders, "7XN4F8R6", checked)?.id).toBe("t1");
  });

  it("still prefers an exact ticket code over the order it belongs to", () => {
    expect(resolveHolder(party(), "7XN4F8R6-2")?.id).toBe("t2");
  });

  it("does not match a different order that starts the same way", () => {
    const holders = [
      { id: "x", code: "7XN4F8R6X-1", qrToken: "a", sessionId: "s1" },
    ];
    // The separator is required, so `7XN4F8R6` must not reach `7XN4F8R6X-1`.
    expect(resolveHolder(holders, "7XN4F8R6")).toBeUndefined();
  });

  it("returns nothing for an order code that exists nowhere", () => {
    expect(resolveHolder(party(), "ZZZZZZZZ")).toBeUndefined();
  });
});

/**
 * The seam that makes the order-code path work at all.
 *
 * `resolveHolder` turns whatever was typed into a *holder*; the server then
 * looks the admission up by `qrToken` and by nothing else. So the panel must
 * send `holder.qrToken` — the resolved token — and never the raw input.
 *
 * Sending the typed string instead looks harmless and is: for a scan, the input
 * *is* the token. It breaks only the two paths a human uses, silently, with the
 * server answering 404 for a ticket that plainly exists. Worth a test precisely
 * because the failure is invisible from either side alone.
 */
describe("the panel hands the server a token, not what was typed", () => {
  const panel = () =>
    readFileSync(
      join(process.cwd(), "components/checkin/CheckinPanel.tsx"),
      "utf8",
    );

  it("posts the resolved holder's token", () => {
    expect(panel()).toMatch(/qrToken: holder\.qrToken/);
    // Never the input box, and never the scanner's raw read.
    expect(panel()).not.toMatch(/qrToken: (code|input|raw)\b/);
  });

  it("passes the admitted set in, so a party is walked through", () => {
    // Without `checked`, every read of one order code returns the same ticket
    // and the second person in a party is told they are already inside.
    expect(panel()).toMatch(/resolveHolder\(holders, input, checked\)/);
  });

  it("names the event explicitly, so a token cannot cross doors", () => {
    expect(panel()).toMatch(/eventId: event\?\.id/);
  });
});
