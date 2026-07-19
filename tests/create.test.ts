import { describe, it, expect } from "vitest";

import {
  initialDraft,
  emptySession,
  emptyTicket,
  expandSessions,
  type CreateDraft,
} from "@/lib/create/types";
import { validateDraft } from "@/lib/create/validation";

function draft(overrides: Partial<CreateDraft> = {}): CreateDraft {
  return { ...initialDraft, ...overrides };
}

function session(id: string, date: string, start = "18:00", end = "20:00") {
  return { ...emptySession(id), date, startTime: start, endTime: end };
}

describe("expandSessions", () => {
  it("single mode returns the one dated session", () => {
    const d = draft({ scheduleMode: "single", sessions: [session("s1", "2026-09-01")] });
    expect(expandSessions(d)).toHaveLength(1);
  });

  it("single mode drops undated sessions", () => {
    const d = draft({ scheduleMode: "single", sessions: [emptySession("s1")] });
    expect(expandSessions(d)).toHaveLength(0);
  });

  it("multi mode keeps every dated سانس", () => {
    const d = draft({
      scheduleMode: "multi",
      sessions: [session("s1", "2026-09-01"), session("s2", "2026-09-02")],
    });
    expect(expandSessions(d)).toHaveLength(2);
  });

  it("recurring repeats a single سانس across occurrences", () => {
    const d = draft({
      scheduleMode: "recurring",
      sessions: [session("s1", "2026-09-01")],
      recurrence: { frequency: "weekly", interval: "1", byDay: [], count: "4" },
    });
    const out = expandSessions(d);
    expect(out).toHaveLength(4);
    // weekly, +7 days each
    expect(out[0].date).toBe("2026-09-01");
    expect(out[1].date).toBe("2026-09-08");
    expect(out[3].date).toBe("2026-09-22");
  });

  it("recurring repeats MULTIPLE سانس per occurrence (count × سانس)", () => {
    const d = draft({
      scheduleMode: "recurring",
      sessions: [
        session("s1", "2026-09-01", "18:00", "20:00"),
        session("s2", "2026-09-01", "21:00", "23:00"),
      ],
      recurrence: { frequency: "weekly", interval: "1", byDay: [], count: "3" },
    });
    expect(expandSessions(d)).toHaveLength(6); // 3 نوبت × 2 سانس
  });

  it("recurring clamps count to a sane maximum", () => {
    const d = draft({
      scheduleMode: "recurring",
      sessions: [session("s1", "2026-09-01")],
      recurrence: { frequency: "daily", interval: "1", byDay: [], count: "999" },
    });
    expect(expandSessions(d).length).toBeLessThanOrEqual(60);
  });
});

describe("validateDraft", () => {
  const ok = (): CreateDraft =>
    draft({
      title: "رویداد",
      location: { mode: "in-person", venueName: "سالن", city: "تهران", address: "", onlineUrl: "", lat: null, lng: null },
      scheduleMode: "single",
      sessions: [session("s1", "2026-09-01")],
      ticketTypes: [{ ...emptyTicket("t1"), name: "بلیت", kind: "paid", price: "100000" }],
    });

  it("passes a complete in-person draft", () => {
    expect(Object.keys(validateDraft(ok()))).toHaveLength(0);
  });

  it("requires a title", () => {
    expect(validateDraft(draft({ ...ok(), title: "  " })).title).toBeTruthy();
  });

  it("requires venue + city for in-person events", () => {
    const e = validateDraft(
      draft({ ...ok(), location: { mode: "in-person", venueName: "", city: "", address: "", onlineUrl: "", lat: null, lng: null } }),
    );
    expect(e.venueName).toBeTruthy();
    expect(e.city).toBeTruthy();
  });

  it("requires an online url for online events", () => {
    const e = validateDraft(
      draft({ ...ok(), location: { mode: "online", venueName: "", city: "", address: "", onlineUrl: "", lat: null, lng: null } }),
    );
    expect(e.onlineUrl).toBeTruthy();
  });

  it("requires at least one dated session", () => {
    expect(validateDraft(draft({ ...ok(), sessions: [emptySession("s1")] })).sessions).toBeTruthy();
  });

  it("requires a price for paid tickets", () => {
    const bad = { ...ok(), ticketTypes: [{ ...emptyTicket("t1"), name: "بلیت", kind: "paid" as const, price: "" }] };
    expect(validateDraft(draft(bad))["ticket-t1"]).toBeTruthy();
  });

  it("free tickets need no price", () => {
    const free = { ...ok(), ticketTypes: [{ ...emptyTicket("t1"), name: "رایگان", kind: "free" as const }] };
    expect(validateDraft(draft(free))["ticket-t1"]).toBeUndefined();
  });

  it("private events need an access code or approval", () => {
    const priv = draft({ ...ok(), visibility: "private", accessCode: "", requireApproval: false });
    expect(validateDraft(priv).privacy).toBeTruthy();
    const withCode = draft({ ...ok(), visibility: "private", accessCode: "X", requireApproval: false });
    expect(validateDraft(withCode).privacy).toBeUndefined();
  });
});
