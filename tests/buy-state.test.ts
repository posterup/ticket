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

  /**
   * A free event is a listing, not a purchase.
   *
   * It used to route to checkout for a «دریافت بلیت» that created an order,
   * settled it at zero and issued a QR code. Poster does not sell these: it
   * says what is happening and where, and the visitor turns up. So the state
   * still reads «رایگان», and offers nothing to press.
   */
  it("calls a free event free and offers nothing to buy", () => {
    const state = resolveBuyState(event(), [ticket({ price: 0 })]);
    expect(state.badge?.label).toBe("رایگان");
    expect(state.title).toBe("ورود آزاد");
    expect(state.action.type).toBe("none");
    // Nothing to press means nothing to label.
    expect("label" in state.action).toBe(false);
  });

  it("still sends a fully paid event to checkout", () => {
    // The `none` branch must not swallow the ordinary on-sale path.
    const state = resolveBuyState(event(), [ticket({ price: 250_000 })]);
    expect(state.action.type).toBe("buy");
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
    expect(src).toMatch(/disabled=\{submitting \|\| !priceKnown \|\| !hasBasket\}/);
  });

  it("shimmers the amount rather than printing a guess", () => {
    expect(src).toMatch(/priceKnown \? \(/);
    expect(src).toContain("<Skeleton");
  });

  /**
   * The empty basket is a separate lie from the unknown price.
   *
   * `seats.every(...)` is vacuously true on `[]`, so an untouched seated
   * checkout had a *known* total of zero: both money rows rendered «رایگان» —
   * `formatToman(0)` says so by design — and the button read «دریافت بلیت» on
   * a paid concert. `priceKnown` cannot catch it, because there is no unknown
   * price to wait for when nothing is selected.
   */
  it("knows the difference between free and nothing selected", () => {
    expect(src).toMatch(/const hasBasket = assigned/);
    expect(src).toMatch(/seats\.length > 0 \|\| standing !== null/);
  });

  it("renders «—» rather than «رایگان» for an empty basket", () => {
    // Both rows: the subtotal and the payable total.
    expect(src).toMatch(/hasBasket \? formatToman\(subtotal\) : "—"/);
    expect(src).toMatch(/!hasBasket \? \(\s*<dd[^>]*>—<\/dd>/);
  });

  it("names the missing step on the button instead of quoting a price", () => {
    expect(src).toContain("ابتدا صندلی انتخاب کنید");
    expect(src).toContain("ابتدا تعداد را مشخص کنید");
  });
});

/**
 * Checkout has to say what is being bought, and hand over the code before the
 * gateway rather than after it.
 *
 * Source-level for the same reason as above: these are facts about the
 * component, not about any one render.
 */
describe("checkout keeps the buyer oriented", () => {
  const src = readFileSync(
    join(process.cwd(), "components/checkout/CheckoutForm.tsx"),
    "utf8",
  );

  it("names the event, the showing and the venue on the form itself", () => {
    // Not only inside the post-submit success card, which is where the title
    // used to be spent.
    expect(src).toMatch(/<h1[^>]*>\s*\{eventTitle\}/);
    expect(src).toMatch(/formatJalaliDate\(session\.startAt\)/);
    expect(src).toMatch(/eventVenue,/);
  });

  it("offers a way back to the event", () => {
    expect(src).toContain("بازگشت به رویداد");
  });

  it("shows the tracking code before leaving for the gateway", () => {
    // The redirect moved behind a paint precisely so this can be seen.
    expect(src).toMatch(/requestAnimationFrame/);
    expect(src).toMatch(/\{handoff\.code\}/);
    expect(src).not.toMatch(
      /window\.location\.assign\(payJson\.data\.redirectUrl/,
    );
  });

  it("remembers a started payment so Back does not duplicate it", () => {
    expect(src).toMatch(/PENDING_KEY/);
    expect(src).toContain("سفارش در انتظار پرداخت دارید");
    expect(src).toMatch(/sessionStorage\.setItem\(\s*PENDING_KEY/);
  });

  it("shows the hold countdown next to the pay button", () => {
    expect(src).toMatch(/useHoldTimer\(holdExpiresAt\)/);
    expect(src).toMatch(/holdVisible/);
  });

  it("no longer promises the seats are held until payment completes", () => {
    // They are not: the seat hold lapses after twenty minutes, and then the
    // order does after fifteen more. Matching the tail of the old sentence
    // rather than «تا پایان پرداخت», which the comment above the replacement
    // still quotes on purpose.
    expect(src).not.toContain("برای کس دیگری قابل انتخاب نیستند");
  });
});
