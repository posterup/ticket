/**
 * The text of every transactional SMS, as pure functions.
 *
 * Lifted out of the notification modules for two reasons. The obvious one is
 * testability: the wording lived inside `async` functions that first query
 * Postgres, so nothing could assert what a buyer actually receives without a
 * database and a settled order.
 *
 * The other is cost. Persian is outside GSM-7, so an SMS carrying it is encoded
 * UCS-2 at **70 characters per segment** — and operators bill per segment, per
 * recipient. A sentence added here is a line item on the organiser's invoice for
 * every sale, forever. `smsSegments` exists so that trade is made with a number
 * rather than a shrug.
 */

import { formatJalaliDate, formatNumber, formatTime, formatToman } from "@/lib/format";

/** Persian digits read better in an SMS than ASCII ones. */
const fa = (n: number) => formatNumber(n);

/** GSM-7 covers Latin, digits and a little punctuation; anything else is UCS-2. */
const GSM7 = /^[A-Za-z0-9 \r\n@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà^{}\\[~\]|€]*$/;

/**
 * How many SMS segments this text bills as.
 *
 * The concatenation headers shrink each segment once a message spans more than
 * one — 153 from 160 for GSM-7, 67 from 70 for UCS-2 — so a message two
 * characters over the limit costs two full segments, not 1.02.
 */
export function smsSegments(text: string): number {
  // Surrogate pairs (emoji) count as two UCS-2 units, which `.length` already
  // reflects; `[...text].length` would undercount them.
  const units = text.length;
  if (units === 0) return 0;
  const gsm = GSM7.test(text);
  const single = gsm ? 160 : 70;
  const multi = gsm ? 153 : 67;
  return units <= single ? 1 : Math.ceil(units / multi);
}

export interface OrderPaidFacts {
  eventTitle: string;
  /** Tickets in the order. */
  count: number;
  total: number;
  /** Pre-formatted seat list, or "" for open seating. */
  seats: string;
  code: string;
  /** Start of the showing this order names, when it names one. */
  startAt?: string;
  /** Deployment origin, for the order link. Omitted when unset. */
  appUrl?: string;
}

/**
 * What the buyer gets.
 *
 * Carried the title, the count, the price and the order code — everything about
 * the transaction and nothing about the event. A confirmation that does not say
 * *when* is the one message a buyer keeps and then has to leave to act on, which
 * the waitlist notice had always understood: `notifyWaiting` has included the
 * date since it shipped.
 *
 * The link is the other half. The order page is where the QR lives, and it is
 * public by order code, so a buyer with no account can still open their ticket
 * from the message. Omitted rather than guessed when `APP_URL` is unset — a
 * relative path in an SMS is not a link.
 */
export function orderPaidBuyerText(facts: OrderPaidFacts): string {
  const when = facts.startAt
    ? `\n${formatJalaliDate(facts.startAt)} ساعت ${formatTime(facts.startAt)}`
    : "";
  const link = facts.appUrl
    ? `\n${facts.appUrl.replace(/\/+$/, "")}/orders/${facts.code}`
    : "";

  return (
    `بلیت شما صادر شد ✅\n` +
    `${facts.eventTitle}${when}\n` +
    `${fa(facts.count)} بلیت · ${formatToman(facts.total)}${facts.seats}\n` +
    `کد پیگیری: ${facts.code}${link}`
  );
}

/**
 * What the organiser gets.
 *
 * Deliberately shorter. It goes to every owner and admin on every sale, so each
 * line is multiplied by the size of the team and the size of the event — and
 * unlike the buyer, they have the dashboard one tap away for anything more.
 */
export function orderPaidOrganiserText(facts: {
  eventTitle: string;
  count: number;
  total: number;
  buyerName: string;
}): string {
  return (
    `فروش تازه 🎟\n` +
    `${facts.eventTitle}\n` +
    `${fa(facts.count)} بلیت · ${formatToman(facts.total)}\n` +
    `خریدار: ${facts.buyerName}`
  );
}

/** Shared tail: the refund is real but manual, worked from the dashboard. */
const REFUND_LINE =
  "مبلغ بلیت شما بازگردانده می‌شود. برای پیگیری به «سفارش‌های من» مراجعه کنید.";

/**
 * One سانس is off; the rest of the event stands.
 *
 * Naming the showing is the whole point and the easiest thing to lose. A
 * recurring event has many, a holder may have tickets to several, and «این
 * رویداد برگزار نمی‌شود» against a weekly class would read as *all of them*
 * cancelled. The date is what makes this message actionable rather than
 * alarming.
 */
export function sessionCancelledText(facts: {
  eventTitle: string;
  /** ISO start of the cancelled showing. */
  startAt: string;
}): string {
  const when = `${formatJalaliDate(facts.startAt)} ساعت ${formatTime(facts.startAt)}`;
  return (
    `لغو سانس ⚠️\n` +
    `${facts.eventTitle}\n` +
    `سانس ${when} برگزار نمی‌شود.\n` +
    REFUND_LINE
  );
}

/** The whole event is off — every showing, no date to name. */
export function eventCancelledText(facts: { eventTitle: string }): string {
  return (
    `لغو رویداد ⚠️\n` +
    `${facts.eventTitle}\n` +
    `این رویداد برگزار نمی‌شود.\n` +
    REFUND_LINE
  );
}

/** `https://host/path`, or "" when `APP_URL` is unset. A relative path is not a link. */
function link(appUrl: string | undefined, path: string): string {
  return appUrl ? `\n${appUrl.replace(/\/+$/, "")}${path}` : "";
}

/**
 * A join request was accepted.
 *
 * The old wording said «{N} بلیت برای شما نگه داشته شده» — *N tickets are held
 * for you*. Nothing held them. `setRegistrationStatus` writes a status and
 * sends this text; the only thing an ACCEPTED row does is satisfy the gate in
 * `createOrder`, and inventory is still claimed first-come by `reserve()` at
 * order time.
 *
 * So an organiser approving fifty people for thirty seats sent fifty texts
 * promising a reservation, and twenty of them met «ظرفیت تکمیل شده» at checkout
 * having been told their tickets were waiting. Unlike the refund promise on a
 * cancellation, nothing anywhere warned the organiser this could happen.
 *
 * The fix here is honesty, not inventory: it says what approval actually buys
 * you — permission, and a limit — plus the urgency that is genuinely real.
 * Actually reserving on approval is a product change (it needs a TTL, a release
 * path, and a capacity story) and is not something to smuggle into a string.
 */
export function registrationAcceptedText(facts: {
  eventTitle: string;
  /** How many tickets the request was for. */
  tickets: number;
  eventId: string;
  appUrl?: string;
}): string {
  return (
    `درخواست شما تأیید شد ✅\n` +
    `${facts.eventTitle}\n` +
    `اکنون می‌توانید تا ${fa(facts.tickets)} بلیت تهیه کنید. ظرفیت محدود است.` +
    link(facts.appUrl, `/events/${facts.eventId}`)
  );
}

/** A join request was declined. No link — there is nothing to go and do. */
export function registrationRejectedText(facts: { eventTitle: string }): string {
  return (
    `درخواست شما پذیرفته نشد\n` +
    `${facts.eventTitle}\n` +
    `ظرفیت این رویداد محدود است. از همراهی شما ممنونیم.`
  );
}

/**
 * A seat came free and the waitlist is being told.
 *
 * Honest about the race — «هرکس زودتر اقدام کند» is how `notifyWaitlist`
 * describes itself, and nothing is reserved for anyone. That makes the link the
 * whole message: telling somebody to hurry and then making them go and find the
 * event is the one place a missing URL costs them the thing they were promised
 * a chance at.
 */
export function waitlistOpeningText(facts: {
  eventTitle: string;
  eventId: string;
  appUrl?: string;
}): string {
  return (
    `جای خالی پیدا شد 🎟\n` +
    `${facts.eventTitle}\n` +
    `برای خرید عجله کنید — ظرفیت محدود است.` +
    link(facts.appUrl, `/events/${facts.eventId}`)
  );
}

/** An organiser asked someone to help run an event. */
export function collaboratorInvitedText(facts: {
  eventTitle: string;
  /** Already resolved to a human label — «ورودی و پذیرش» or «میزبان همکار». */
  job: string;
  appUrl?: string;
}): string {
  return (
    `دعوت به همکاری 🤝\n` +
    `${facts.eventTitle}\n` +
    `از شما برای «${facts.job}» دعوت شده است.\n` +
    `برای پذیرفتن به «دعوت‌ها» در پوستر سر بزنید.` +
    link(facts.appUrl, "/me")
  );
}
