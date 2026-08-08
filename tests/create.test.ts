import { describe, it, expect } from "vitest";

import {
  DEFAULT_DURATION_MIN,
  emptySlot,
  initialDraft,
  emptyTicket,
  nextSlot,
  expandSessions,
  sessionInstants,
  slotFromStored,
  slotToStored,
  type CreateDraft,
  type ScheduleDraft,
} from "@/lib/create/types";
import { addMinutes, minutesBetween } from "@/lib/format";
import { validateDraft } from "@/lib/create/validation";

function draft(overrides: Partial<CreateDraft> = {}): CreateDraft {
  return { ...initialDraft, ...overrides };
}

function schedule(o: Partial<ScheduleDraft> = {}): ScheduleDraft {
  return {
    calendar: false,
    startDate: "",
    endDate: "",
    byDay: [],
    slots: [{ id: "slot-1", date: "2026-09-01", startTime: "18:00", durationMin: "120" }],
    daySlots: {},
    exceptions: [],
    ...o,
  };
}

/** A calendar-mode schedule (dates come from the range; slots are time-only). */
function calSchedule(o: Partial<ScheduleDraft> = {}): ScheduleDraft {
  return schedule({
    calendar: true,
    startDate: "2026-09-01",
    slots: [{ id: "slot-1", date: "", startTime: "18:00", durationMin: "120" }],
    ...o,
  });
}

describe("expandSessions", () => {
  it("non-calendar: one dated سانس yields one session", () => {
    expect(expandSessions(draft({ schedule: schedule() }))).toHaveLength(1);
  });

  it("non-calendar: an undated سانس yields nothing", () => {
    const s = schedule({ slots: [{ id: "slot-1", date: "", startTime: "18:00", durationMin: "120" }] });
    expect(expandSessions(draft({ schedule: s }))).toHaveLength(0);
  });

  it("non-calendar: each سانس keeps its own date", () => {
    const s = schedule({
      slots: [
        { id: "a", date: "2026-09-01", startTime: "18:00", durationMin: "120" },
        { id: "b", date: "2026-09-05", startTime: "21:00", durationMin: "120" },
      ],
    });
    const out = expandSessions(draft({ schedule: s }));
    expect(out.map((x) => x.date)).toEqual(["2026-09-01", "2026-09-05"]);
  });

  it("calendar: no start date yields nothing", () => {
    expect(expandSessions(draft({ schedule: calSchedule({ startDate: "" }) }))).toHaveLength(0);
  });

  it("calendar: a date range × سانس‌ها = days × slots", () => {
    const s = calSchedule({
      endDate: "2026-09-03", // 3 days
      slots: [
        { id: "a", date: "", startTime: "18:00", durationMin: "120" },
        { id: "b", date: "", startTime: "21:00", durationMin: "120" },
      ],
    });
    expect(expandSessions(draft({ schedule: s }))).toHaveLength(6); // 3 × 2
  });

  it("calendar: filters the range to the chosen weekdays", () => {
    // 2026-09-01 is a Tuesday; keep only Saturdays in a one-week range.
    const s = calSchedule({ endDate: "2026-09-07", byDay: ["SA"] });
    const out = expandSessions(draft({ schedule: s }));
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe("2026-09-05"); // the Saturday
  });

  it("calendar: caps a very wide range", () => {
    const s = calSchedule({ startDate: "2026-01-01", endDate: "2030-01-01" });
    expect(expandSessions(draft({ schedule: s })).length).toBeLessThanOrEqual(366);
  });

  it("calendar: skips exception dates", () => {
    const s = calSchedule({ endDate: "2026-09-03", exceptions: ["2026-09-02"] });
    const out = expandSessions(draft({ schedule: s }));
    expect(out).toHaveLength(2); // 3 days minus 1 exception
    expect(out.map((x) => x.date)).not.toContain("2026-09-02");
  });

  it("calendar: adds a weekday's extra سانس", () => {
    // 2026-09-05 is a Saturday.
    const s = calSchedule({
      startDate: "2026-09-05",
      endDate: "2026-09-05",
      byDay: ["SA"],
      slots: [{ id: "g", date: "", startTime: "18:00", durationMin: "120" }],
      daySlots: { SA: [{ id: "sa-extra", date: "", startTime: "21:00", durationMin: "120" }] },
    });
    expect(expandSessions(draft({ schedule: s }))).toHaveLength(2); // global + extra
  });
});

describe("nextSlot", () => {
  const previous = {
    id: "a",
    date: "2026-09-01",
    startTime: "18:00",
    durationMin: "90",
  };

  it("carries the time and length over to the next سانس", () => {
    const next = nextSlot("b", previous);
    expect(next.startTime).toBe("18:00");
    expect(next.durationMin).toBe("90");
  });

  it("leaves the date empty — that is the field that differs", () => {
    // Inheriting it would hand back a duplicate to notice and clear, and a
    // copied date *and* time collides on `EventSession`'s (eventId, startAt).
    expect(nextSlot("b", previous).date).toBe("");
  });

  it("is a blank سانس when there is nothing to copy", () => {
    expect(nextSlot("b")).toEqual(emptySlot("b"));
  });
});

describe("duration ⇄ end clock", () => {
  it("wraps past midnight instead of going negative", () => {
    expect(addMinutes("23:00", 120)).toBe("01:00");
    expect(minutesBetween("23:00", "01:00")).toBe(120);
  });

  it("round-trips a stored slot through the draft and back", () => {
    const stored = { id: "s", startTime: "18:00", endTime: "19:30" };
    const draftSlot = slotFromStored(stored);
    expect(draftSlot.durationMin).toBe("90");
    expect(slotToStored(draftSlot)).toEqual(stored);
  });

  it("falls back to the default when the stored pair is unreadable", () => {
    expect(slotFromStored({ id: "s", startTime: "18:00", endTime: "" }).durationMin).toBe(
      DEFAULT_DURATION_MIN,
    );
  });

  it("ends a late سانس on the next day, not before its own start", () => {
    // The bug this replaced: `venueIso(date, "01:00")` put the end 22 hours
    // before the start, because it reused the start's calendar date.
    const { startAt, endAt } = sessionInstants({
      id: "s",
      date: "2026-09-01",
      startTime: "23:00",
      durationMin: 120,
    });
    expect(Date.parse(endAt) - Date.parse(startAt)).toBe(120 * 60_000);
    expect(endAt > startAt).toBe(true);
  });
});

describe("validateDraft", () => {
  const ok = (): CreateDraft =>
    draft({
      title: "رویداد",
      location: { mode: "in-person", province: "تهران", city: "تهران", venueName: "سالن", address: "", onlineUrl: "", lat: null, lng: null, hideAddress: false },
      schedule: schedule(),
      ticketTypes: [{ ...emptyTicket("t1"), name: "بلیت", kind: "paid", price: "100000" }],
    });

  it("passes a complete in-person draft", () => {
    expect(Object.keys(validateDraft(ok()))).toHaveLength(0);
  });

  it("requires a title", () => {
    expect(validateDraft(draft({ ...ok(), title: "  " })).title).toBeTruthy();
  });

  it("requires province + city for in-person events", () => {
    const e = validateDraft(
      draft({ ...ok(), location: { mode: "in-person", province: "", city: "", venueName: "", address: "", onlineUrl: "", lat: null, lng: null, hideAddress: false } }),
    );
    expect(e.province).toBeTruthy();
    expect(e.city).toBeTruthy();
  });

  it("does not require a venue name for in-person events", () => {
    const e = validateDraft(
      draft({ ...ok(), location: { mode: "in-person", province: "تهران", city: "تهران", venueName: "", address: "", onlineUrl: "", lat: null, lng: null, hideAddress: false } }),
    );
    expect(e.venueName).toBeUndefined();
    expect(e.province).toBeUndefined();
    expect(e.city).toBeUndefined();
  });

  it("requires an online url for online events", () => {
    const e = validateDraft(
      draft({ ...ok(), location: { mode: "online", province: "", city: "", venueName: "", address: "", onlineUrl: "", lat: null, lng: null, hideAddress: false } }),
    );
    expect(e.onlineUrl).toBeTruthy();
  });

  it("calendar mode requires a start date", () => {
    expect(validateDraft(draft({ ...ok(), schedule: calSchedule({ startDate: "" }) })).schedule).toBeTruthy();
  });

  it("non-calendar requires a dated سانس", () => {
    const s = schedule({ slots: [{ id: "x", date: "", startTime: "", durationMin: "" }] });
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
});
