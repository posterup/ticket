/**
 * What the buy box says, and why.
 *
 * `resolveBuyState` looked only at ticket types. An event whose سانس‌ها were all
 * cancelled — or all marked «تکمیل ظرفیت» by the organiser — still offered
 * «خرید بلیت»; the server refuses every one of them and the checkout page
 * disables the buttons, so the buyer discovered it only after clicking through
 * to a page where nothing was selectable.
 *
 * `docs/venue-architecture.md` claimed this function was unit-tested. It was
 * not — it lived inside a Server Component. Now it is both.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

import { resolveBuyState } from "@/lib/events/buy-state";
import type { Event, EventSession, TicketType } from "@/types";

const iso = (d: string) => new Date(d).toISOString();

const ticket = (over: Partial<TicketType> = {}): TicketType =>
  ({
    id: "t1",
    eventId: "e1",
    name: "عادی",
    price: 200_000,
    capacity: 100,
    sold: 0,
    reserved: 0,
    salesStartAt: iso("2020-01-01"),
    salesEndAt: iso("2030-01-01"),
    category: "general",
    createdAt: iso("2020-01-01"),
    ...over,
  }) as TicketType;

const session = (over: Partial<EventSession> = {}): EventSession =>
  ({
    id: "s1",
    eventId: "e1",
    startAt: iso("2027-01-01T18:00:00Z"),
    endAt: iso("2027-01-01T20:00:00Z"),
    cancelled: false,
    availability: "available",
    ...over,
  }) as EventSession;

const event = (over: Partial<Event> = {}): Event =>
  ({
    id: "e1",
    workspaceId: "w1",
    title: "رویداد",
    description: "",
    mode: "one-time",
    status: "published",
    sessions: [session()],
    tags: [],
    categories: [],
    visibility: "public",
    createdAt: iso("2020-01-01"),
    updatedAt: iso("2020-01-01"),
    ...over,
  }) as Event;

describe("when every showing is off", () => {
  it("says the event is cancelled, not that tickets sold out", () => {
    const state = resolveBuyState(
      event({ sessions: [session({ cancelled: true })] }),
      [ticket()],
    );
    expect(state.badge?.label).toBe("لغو شده");
    expect(state.action.type).toBe("closed");
    // The buyer's money is the first thing they will wonder about.
    expect(state.subtitle).toContain("بازگردانده");
  });

  it("offers the waitlist when every سانس is «تکمیل ظرفیت»", () => {
    const state = resolveBuyState(
      event({
        waitlist: true,
        sessions: [session({ availability: "full" })],
      }),
      [ticket()],
    );
    expect(state.action.type).toBe("waitlist");
  });

  it("closes rather than waitlists when the organiser did not enable one", () => {
    const state = resolveBuyState(
      event({ sessions: [session({ availability: "full" })] }),
      [ticket()],
    );
    expect(state.action.type).toBe("closed");
  });

  it("offers «خبرم کن» when every سانس is «به زودی»", () => {
    const state = resolveBuyState(
      event({ sessions: [session({ availability: "soon" })] }),
      [ticket()],
    );
    expect(state.action.type).toBe("notify");
  });

  it("prefers cancelled over sold-out when they are mixed", () => {
    // Neither is bookable, but "the show is not happening" is the more useful
    // answer than "the tickets ran out".
    const state = resolveBuyState(
      event({
        sessions: [session({ cancelled: true }), session({ id: "s2", availability: "full" })],
      }),
      [ticket()],
    );
    expect(state.badge?.label).toBe("تکمیل ظرفیت");
    expect(state.action.type).toBe("closed");
  });
});

describe("when at least one showing is bookable", () => {
  it("sells, even if the others are cancelled", () => {
    const state = resolveBuyState(
      event({
        sessions: [session({ cancelled: true }), session({ id: "s2" })],
      }),
      [ticket()],
    );
    expect(state.action.type).toBe("buy");
  });

  it("treats «رو به اتمام» as bookable — it is an urgency hint", () => {
    const state = resolveBuyState(
      event({ sessions: [session({ availability: "almost-full" })] }),
      [ticket()],
    );
    expect(state.action.type).toBe("buy");
  });
});

describe("the states that were already there", () => {
  it("still reports sold out when stock is gone", () => {
    const state = resolveBuyState(event(), [
      ticket({ capacity: 10, sold: 10 }),
    ]);
    expect(state.badge?.label).toBe("تکمیل ظرفیت");
  });

  it("still routes an approval event to a request", () => {
    const state = resolveBuyState(event({ requiresApproval: true }), [ticket()]);
    expect(state.action.type).toBe("approval");
  });

  it("still calls a free event free", () => {
    const state = resolveBuyState(event(), [ticket({ price: 0 })]);
    expect(state.action.label).toBe("دریافت بلیت");
  });

  /**
   * A free ticket alongside a paid one does not make the event free.
   *
   * `Math.min(...prices) === 0` asked whether *any* ticket was free. The
   * dashboard asks the opposite question — `tickets.every((t) => t.price === 0)`
   * — and the two sides disagreeing is the whole bug: an organiser who adds a
   * free «دانشجو» tier beside a paid «عادی» one keeps their tickets, discounts
   * and refunds tabs, while the public page advertises «ورود آزاد» and
   * «بلیت این رویداد رایگان است» over a checkout that then asks for money.
   */
  it("does not call an event free when only one of its tickets is", () => {
    const state = resolveBuyState(event(), [
      ticket({ id: "free", price: 0 }),
      ticket({ id: "paid", price: 250_000 }),
    ]);
    expect(state.badge?.label).not.toBe("رایگان");
    expect(state.title).not.toBe("ورود آزاد");
    // It is still buyable — the price shown is the cheapest, "از ۰ تومان".
    expect(state.action.type).toBe("buy");
  });

  it("still calls an event free when every ticket is", () => {
    const state = resolveBuyState(event(), [
      ticket({ id: "a", price: 0 }),
      ticket({ id: "b", price: 0 }),
    ]);
    expect(state.badge?.label).toBe("رایگان");
    expect(state.title).toBe("ورود آزاد");
  });

  it("still offers «خبرم کن» before sales open", () => {
    const state = resolveBuyState(event(), [
      ticket({ salesStartAt: iso("2099-01-01") }),
    ]);
    expect(state.action.type).toBe("notify");
  });

  it("does not crash on an event with no سانس at all", () => {
    // Only sessions that exist can be unbookable.
    const state = resolveBuyState(event({ sessions: [] }), [ticket()]);
    expect(state.action.type).toBe("buy");
  });
});

/**
 * The checkout summary must not call an unknown price zero.
 *
 * A seat's price arrives from the *availability* endpoint, a separate fetch
 * from the seat geometry, so a seat can be selected before its price is known.
 * `s.price ?? 0` counted that as free — and because the button label keys on
 * `total === 0`, the call to action changed from «پرداخت» to «دریافت بلیت».
 * The buyer was told the order was free and then charged for it.
 *
 * Source-level: the property is "an unknown price is never rendered as a
 * number", which is a fact about the component, not about any render.
 */
describe("the checkout total is honest about what it knows", () => {
  const src = readFileSync(
    join(process.cwd(), "components/checkout/CheckoutForm.tsx"),
    "utf8",
  );

  it("tracks whether every selected seat has a real price", () => {
    expect(src).toMatch(/const priceKnown =/);
    // `typeof … === "number"`, not a truthiness test — a free seat is `0`.
    expect(src).toMatch(/typeof s\.price === "number"/);
  });

  it("does not let a genuinely free seated event be caught by it", () => {
    // `0` is a number, so `priceKnown` stays true and «دریافت بلیت» still shows.
    expect(src).not.toMatch(/seats\.every\(\(s\) => s\.price\)/);
    expect(src).toContain("دریافت بلیت");
  });

  it("blocks submission while the amount is unknown", () => {
    expect(src).toMatch(/disabled=\{submitting \|\| !priceKnown\}/);
  });

  it("shimmers the amount rather than printing a guess", () => {
    expect(src).toMatch(/priceKnown \? \(/);
    expect(src).toContain("<Skeleton");
  });
});
