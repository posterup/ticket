import { describe, it, expect } from "vitest";

import {
  initialDraft,
  emptyTicket,
  expandSessions,
  type CreateDraft,
  type ScheduleDraft,
} from "@/lib/create/types";
import { validateDraft } from "@/lib/create/validation";

function draft(overrides: Partial<CreateDraft> = {}): CreateDraft {
  return { ...initialDraft, ...overrides };
}

function schedule(o: Partial<ScheduleDraft> = {}): ScheduleDraft {
  return {
    calendar: false,
    startDate: "2026-09-01",
    endDate: "",
    byDay: [],
    slots: [{ id: "slot-1", startTime: "18:00", endTime: "20:00" }],
    daySlots: {},
    exceptions: [],
    ...o,
  };
}

describe("expandSessions", () => {
  it("a single day + one سانس yields one session", () => {
    expect(expandSessions(draft({ schedule: schedule() }))).toHaveLength(1);
  });

  it("no start date yields nothing", () => {
    expect(expandSessions(draft({ schedule: schedule({ startDate: "" }) }))).toHaveLength(0);
  });

  it("no timed سانس yields nothing", () => {
    const s = schedule({ slots: [{ id: "slot-1", startTime: "", endTime: "" }] });
    expect(expandSessions(draft({ schedule: s }))).toHaveLength(0);
  });

  it("a date range × سانس‌ها = days × slots", () => {
    const s = schedule({
      startDate: "2026-09-01",
      endDate: "2026-09-03", // 3 days
      slots: [
        { id: "a", startTime: "18:00", endTime: "20:00" },
        { id: "b", startTime: "21:00", endTime: "23:00" },
      ],
    });
    expect(expandSessions(draft({ schedule: s }))).toHaveLength(6); // 3 × 2
  });

  it("calendar mode filters the range to the chosen weekdays", () => {
    // 2026-09-01 is a Tuesday; keep only Saturdays in a one-week range.
    const s = schedule({
      calendar: true,
      startDate: "2026-09-01",
      endDate: "2026-09-07",
      byDay: ["SA"],
    });
    const out = expandSessions(draft({ schedule: s }));
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe("2026-09-05"); // the Saturday
  });

  it("caps a very wide range", () => {
    const s = schedule({ startDate: "2026-01-01", endDate: "2030-01-01" });
    expect(expandSessions(draft({ schedule: s })).length).toBeLessThanOrEqual(366);
  });

  it("skips exception dates", () => {
    const s = schedule({
      startDate: "2026-09-01",
      endDate: "2026-09-03",
      exceptions: ["2026-09-02"],
    });
    const out = expandSessions(draft({ schedule: s }));
    expect(out).toHaveLength(2); // 3 days minus 1 exception
    expect(out.map((x) => x.date)).not.toContain("2026-09-02");
  });

  it("adds a weekday's extra سانس in calendar mode", () => {
    // 2026-09-05 is a Saturday.
    const s = schedule({
      calendar: true,
      startDate: "2026-09-05",
      endDate: "2026-09-05",
      byDay: ["SA"],
      slots: [{ id: "g", startTime: "18:00", endTime: "20:00" }],
      daySlots: { SA: [{ id: "sa-extra", startTime: "21:00", endTime: "23:00" }] },
    });
    expect(expandSessions(draft({ schedule: s }))).toHaveLength(2); // global + extra
  });
});

describe("validateDraft", () => {
  const ok = (): CreateDraft =>
    draft({
      title: "رویداد",
      location: { mode: "in-person", venueName: "سالن", city: "تهران", address: "", onlineUrl: "", lat: null, lng: null },
      schedule: schedule(),
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

  it("requires a start date", () => {
    expect(validateDraft(draft({ ...ok(), schedule: schedule({ startDate: "" }) })).schedule).toBeTruthy();
  });

  it("requires a سانس with a start time", () => {
    const s = schedule({ slots: [{ id: "x", startTime: "", endTime: "" }] });
    expect(validateDraft(draft({ ...ok(), schedule: s })).schedule).toBeTruthy();
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
