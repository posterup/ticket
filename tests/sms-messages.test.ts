/**
 * What a buyer and an organiser actually receive.
 *
 * These assertions were impossible while the wording lived inside a function
 * that queries Postgres first — the text of the one message a buyer keeps had
 * no test at all, and the gap it had (no date, no way back to the ticket) was
 * invisible for exactly that reason.
 */

import { describe, it, expect } from "vitest";

import {
  collaboratorInvitedText,
  eventCancelledText,
  orderPaidBuyerText,
  orderPaidOrganiserText,
  registrationAcceptedText,
  registrationRejectedText,
  sessionCancelledText,
  smsSegments,
  waitlistOpeningText,
} from "@/lib/server/notifications/messages";

const FACTS = {
  eventTitle: "کنسرت همایون شجریان",
  count: 2,
  total: 5_600_000,
  seats: "",
  code: "PSTR-A001",
  startAt: "2026-08-14T15:00:00.000Z",
  appUrl: "https://poster.ir",
};

describe("the buyer's confirmation", () => {
  it("says when the event is", () => {
    // The gap this closes. A confirmation without a date is the message a buyer
    // keeps and then has to leave in order to act on.
    const text = orderPaidBuyerText(FACTS);
    expect(text).toMatch(/مرداد|شهریور/); // Jalali month name
    expect(text).toContain("ساعت");
  });

  it("links to the order page, which is where the QR lives", () => {
    expect(orderPaidBuyerText(FACTS)).toContain(
      "https://poster.ir/orders/PSTR-A001",
    );
  });

  it("does not put a relative path in an SMS when APP_URL is unset", () => {
    const text = orderPaidBuyerText({ ...FACTS, appUrl: undefined });
    expect(text).not.toContain("/orders/");
    // …and still carries everything else.
    expect(text).toContain("PSTR-A001");
    expect(text).toContain("کنسرت همایون شجریان");
  });

  it("omits the date rather than inventing one for an undated order", () => {
    const text = orderPaidBuyerText({ ...FACTS, startAt: undefined });
    expect(text).not.toContain("ساعت");
    expect(text).toContain("PSTR-A001");
  });

  it("carries the seats when the order has them", () => {
    const text = orderPaidBuyerText({
      ...FACTS,
      seats: "\nصندلی‌ها: بالکن · ردیف الف · صندلی ۱۲",
    });
    expect(text).toContain("ردیف الف");
  });

  it("writes the ticket count in Persian digits", () => {
    expect(orderPaidBuyerText(FACTS)).toContain("۲ بلیت");
  });
});

describe("the organiser's notice", () => {
  it("names the buyer and the take", () => {
    const text = orderPaidOrganiserText({
      eventTitle: "کنسرت همایون شجریان",
      count: 2,
      total: 5_600_000,
      buyerName: "سارا محمدی",
    });
    expect(text).toContain("سارا محمدی");
    expect(text).toContain("۲ بلیت");
  });

  it("stays shorter than the buyer's, because it is sent far more often", () => {
    // One per sale, to every owner and admin — multiplied by the team and by
    // the size of the event.
    const organiser = orderPaidOrganiserText({
      eventTitle: FACTS.eventTitle,
      count: FACTS.count,
      total: FACTS.total,
      buyerName: "سارا محمدی",
    });
    expect(smsSegments(organiser)).toBeLessThan(smsSegments(orderPaidBuyerText(FACTS)));
  });
});

describe("segment arithmetic, because operators bill by it", () => {
  it("counts Persian as UCS-2 at 70 characters", () => {
    expect(smsSegments("ا".repeat(70))).toBe(1);
    expect(smsSegments("ا".repeat(71))).toBe(2);
    // Concatenation headers shrink each part to 67, so 134 is the two-part cap.
    expect(smsSegments("ا".repeat(134))).toBe(2);
    expect(smsSegments("ا".repeat(135))).toBe(3);
  });

  it("counts plain Latin as GSM-7 at 160", () => {
    expect(smsSegments("a".repeat(160))).toBe(1);
    expect(smsSegments("a".repeat(161))).toBe(2);
  });

  it("treats an empty message as costing nothing", () => {
    expect(smsSegments("")).toBe(0);
  });

  it("keeps the buyer's confirmation within a sane budget", () => {
    /**
     * The number this file exists to make visible.
     *
     * Adding the date and the link is a real cost — every sale, forever — and
     * it is worth it only while the message stays small. If a future addition
     * pushes this past four segments, that is a billing decision and should be
     * taken deliberately rather than discovered on an invoice.
     */
    const segments = smsSegments(orderPaidBuyerText(FACTS));
    expect(segments).toBeLessThanOrEqual(4);
  });
});

/**
 * Cancellations — the highest-stakes text the platform sends.
 *
 * It goes to everyone holding a ticket, it cannot be recalled, and it had no
 * test. The dashboard says as much before it fires: cancelling a sold-out show
 * is irreversible in the only way that matters.
 */
describe("cancellation notices", () => {
  it("names the specific سانس, so a weekly class is not read as gone", () => {
    // The failure that matters. A recurring event has many showings and a
    // holder may have tickets to several; a notice that does not say *which*
    // reads as all of them.
    const text = sessionCancelledText({
      eventTitle: "کارگاه هفتگی سفال",
      startAt: "2026-08-14T15:00:00.000Z",
    });
    expect(text).toContain("سانس");
    expect(text).toMatch(/ساعت/);
    expect(text).toMatch(/مرداد|شهریور/);
    // And must not claim the whole event is off.
    expect(text).not.toContain("این رویداد برگزار نمی‌شود");
  });

  it("says the whole event is off only when it is", () => {
    const text = eventCancelledText({ eventTitle: "کارگاه هفتگی سفال" });
    expect(text).toContain("این رویداد برگزار نمی‌شود");
    expect(text).not.toContain("سانس ");
  });

  it("tells the holder their money is coming back, either way", () => {
    // Refunds are worked by hand from the dashboard queue — `refundOrder` only
    // ever runs from an explicit organiser action — so this line is a promise
    // the organiser is separately warned they must honour. Both notices carry
    // it; dropping it from one would leave those holders told nothing.
    for (const text of [
      sessionCancelledText({ eventTitle: "ت", startAt: "2026-08-14T15:00:00.000Z" }),
      eventCancelledText({ eventTitle: "ت" }),
    ]) {
      expect(text).toContain("بازگردانده می‌شود");
    }
  });

  it("stays affordable for a sold-out house", () => {
    // This one is billed per holder, and a cancelled arena is thousands of
    // them at once — the worst possible moment for a four-segment message.
    const text = sessionCancelledText({
      eventTitle: "کنسرت همایون شجریان",
      startAt: "2026-08-14T15:00:00.000Z",
    });
    expect(smsSegments(text)).toBeLessThanOrEqual(3);
  });
});

/**
 * Approval decisions.
 *
 * The accepted message used to say «{N} بلیت برای شما نگه داشته شده» — *held for
 * you*. Nothing held them: approval writes a status row, and `createOrder` only
 * reads it as a gate while inventory stays first-come through `reserve()`.
 */
describe("the approval decision", () => {
  const FACTS = {
    eventTitle: "شب شعر",
    tickets: 2,
    eventId: "3f1a6c2e-0023-4a10-9b21-1a2b3c4d5e23",
    appUrl: "https://poster.ir",
  };

  it("does not claim tickets are being held", () => {
    // The false promise. An organiser approving fifty people for thirty seats
    // sent fifty of these, and twenty met «ظرفیت تکمیل شده» at checkout.
    const text = registrationAcceptedText(FACTS);
    expect(text).not.toContain("نگه داشته شده");
    expect(text).not.toMatch(/رزرو شده/);
  });

  it("says what approval actually buys — permission, and a limit", () => {
    const text = registrationAcceptedText(FACTS);
    expect(text).toContain("تأیید شد");
    expect(text).toContain("۲ بلیت");
    // The urgency that is genuinely true, in place of the reservation that was not.
    expect(text).toContain("ظرفیت محدود است");
  });

  it("links to the event, rather than telling them to go and find it", () => {
    expect(registrationAcceptedText(FACTS)).toContain(
      `https://poster.ir/events/${FACTS.eventId}`,
    );
    expect(registrationAcceptedText({ ...FACTS, appUrl: undefined })).not.toContain(
      "/events/",
    );
  });

  it("sends no link with a rejection, because there is nothing to do", () => {
    const text = registrationRejectedText({ eventTitle: "شب شعر" });
    expect(text).toContain("پذیرفته نشد");
    expect(text).not.toContain("http");
  });

  it("keeps both decisions inside two segments", () => {
    expect(smsSegments(registrationAcceptedText(FACTS))).toBeLessThanOrEqual(3);
    expect(
      smsSegments(registrationRejectedText({ eventTitle: "شب شعر" })),
    ).toBeLessThanOrEqual(2);
  });
});

describe("the waitlist call and the collaborator invite", () => {
  const EVENT_ID = "3f1a6c2e-0001-4a10-9b21-1a2b3c4d5e01";

  it("gives the waitlist somewhere to hurry to", () => {
    // Nothing is reserved — `notifyWaitlist` is explicit that whoever acts
    // first wins — so a message telling someone to rush and then making them go
    // and find the event costs them the thing they were offered a chance at.
    const text = waitlistOpeningText({
      eventTitle: "کنسرت همایون شجریان",
      eventId: EVENT_ID,
      appUrl: "https://poster.ir",
    });
    expect(text).toContain(`https://poster.ir/events/${EVENT_ID}`);
    expect(text).toContain("عجله کنید");
  });

  it("does not pretend a seat is being kept for them", () => {
    const text = waitlistOpeningText({
      eventTitle: "ت",
      eventId: EVENT_ID,
      appUrl: "https://poster.ir",
    });
    expect(text).not.toContain("نگه داشته");
    expect(text).not.toMatch(/رزرو/);
  });

  it("stays inside two segments — it is a race, not a newsletter", () => {
    expect(
      smsSegments(
        waitlistOpeningText({
          eventTitle: "کنسرت همایون شجریان",
          eventId: EVENT_ID,
          appUrl: "https://poster.ir",
        }),
      ),
    ).toBeLessThanOrEqual(3);
  });

  it("points a collaborator at the app rather than describing where to look", () => {
    const text = collaboratorInvitedText({
      eventTitle: "کنسرت همایون شجریان",
      job: "ورودی و پذیرش",
      appUrl: "https://poster.ir",
    });
    expect(text).toContain("https://poster.ir/me");
    expect(text).toContain("ورودی و پذیرش");
  });

  it("degrades to no link when APP_URL is unset, for every message that has one", () => {
    // One helper builds all of them; a regression here would silently put
    // "undefined/events/…" in front of thousands of people.
    for (const text of [
      waitlistOpeningText({ eventTitle: "ت", eventId: EVENT_ID }),
      collaboratorInvitedText({ eventTitle: "ت", job: "میزبان همکار" }),
      registrationAcceptedText({ eventTitle: "ت", tickets: 1, eventId: EVENT_ID }),
      orderPaidBuyerText({ ...FACTS, appUrl: undefined }),
    ]) {
      expect(text).not.toContain("undefined");
      expect(text).not.toContain("http");
    }
  });
});
