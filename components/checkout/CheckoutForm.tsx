"use client";

/**
 * Checkout.
 *
 * One form that covers both inventory models the platform sells:
 *
 *  * **Assigned seating** — the showing pins a seat map, so the buyer picks
 *    actual seats and the server derives the ticket type and price from the
 *    section. Selecting a seat takes a real server-side hold, so what is on
 *    screen is genuinely theirs before they type a name.
 *  * **Open seating** — no map, so it is a ticket type and a quantity, exactly
 *    as before.
 *
 * The session picker only appears when there is a choice to make. A one-off
 * event should not ask which showing.
 *
 * Totals shown here are a preview. Prices, discounts and the final amount are
 * all recomputed server-side — what this sends is a request, not a price.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Tag,
  X,
  Loader2,
  Ticket as TicketIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SESSION_AVAILABILITY_LABELS } from "@/lib/events/labels";
import { cn } from "@/lib/utils";
import { formatToman, formatNumber, formatJalaliDate, formatSeat, formatTime } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/wizard/labels";
import { SeatMap } from "@/components/seatmap/SeatMap";
import { useHoldTimer } from "@/components/seatmap/useHoldTimer";
import { Skeleton } from "@/components/ui/skeleton";
import { needsSeatResync } from "@/lib/venues/selection";
import type {
  DiscountKind,
  DiscountValidation,
  EventSession,
  SeatDetail,
  StandingSelection,
  TicketCategory,
} from "@/types";

export interface CheckoutTicket {
  id: string;
  name: string;
  price: number;
  capacity: number;
  category: TicketCategory;
}

interface CheckoutFormProps {
  eventId: string;
  eventTitle: string;
  /** Venue name, for the header that says what is being bought. */
  eventVenue?: string;
  tickets: CheckoutTicket[];
  initialTicketId: string;
  sessions?: EventSession[];
  /** Deep-link a specific showing, e.g. from an SMS or a shared link. */
  initialSessionId?: string;
  /** Signed-in buyer's details, prefilled and still editable. */
  viewer?: { fullName: string; phone: string };
}

interface AppliedDiscount {
  code: string;
  kind: DiscountKind;
  value: number;
}

/**
 * Recompute the discount for the current subtotal (mirrors the server rule).
 *
 * Including the floor: a discount never takes an order to zero. This has to
 * match `computeDiscountAmount` in `lib/server/discounts/rules.ts` exactly, or
 * the summary quotes a total the server then refuses to charge — the same class
 * of bug as quoting «رایگان» for a paid seat.
 */
function discountFor(applied: AppliedDiscount | null, subtotal: number): number {
  if (!applied || subtotal <= 0) return 0;
  const raw =
    applied.kind === "percent"
      ? Math.floor((subtotal * applied.value) / 100)
      : applied.value;
  return Math.max(0, Math.min(raw, subtotal - MIN_PAYABLE_TOMAN));
}

const normalisePhone = (raw: string) => raw.trim().replace(/\s/g, "");

/**
 * The least an order may still owe after a discount.
 *
 * Declared here rather than imported: this is a Client Component, and the
 * authority — `MIN_AMOUNT_TOMAN` in `lib/server/payments/zarinpal-codes.ts`,
 * Zarinpal's own floor — lives under `lib/server`, which UI does not import.
 * The server recomputes every total anyway, so this only has to agree well
 * enough that the summary never quotes a figure the server will refuse.
 */
const MIN_PAYABLE_TOMAN = 100;

/**
 * A started payment the buyer has not finished.
 *
 * Kept in `sessionStorage` because the gateway is a full-page navigation: React
 * state does not survive it, and neither did the buyer's only proof of purchase.
 * Session-scoped rather than `localStorage` — this is one purchase in progress
 * in one tab, not a preference.
 */
const PENDING_KEY = "poster:pending-order";

interface PendingOrder {
  id: string;
  code: string;
  eventId: string;
  /** The proof a guest order accepts in place of a session. */
  phone: string;
  /** The order's own deadline; past it this record is noise. */
  expiresAt?: string;
}

export function CheckoutForm({
  eventId,
  eventTitle,
  eventVenue,
  tickets,
  initialTicketId,
  sessions = [],
  initialSessionId,
  viewer,
}: CheckoutFormProps) {
  // Cancelled showings are not buyable, so they are not offered.
  const bookable = useMemo(
    () =>
      [...sessions]
        .filter((s) => !s.cancelled)
        .sort((a, b) => a.startAt.localeCompare(b.startAt)),
    [sessions],
  );

  /**
   * Showings the organiser has closed.
   *
   * `availability` was written by the dashboard and read by nobody: a سانس
   * marked «تکمیل ظرفیت» or «به زودی» looked identical to an open one and sold
   * happily. The server refuses them now — this is so the buyer finds out
   * before filling in a form rather than after.
   *
   * `almost-full` is deliberately absent: it is an urgency hint meant to sell
   * faster, not a stop.
   */
  const closed = (s: { availability?: string }) =>
    s.availability === "full" || s.availability === "soon";

  // Honour the deep link only if that showing is actually bookable; a stale
  // link to a cancelled سانس should fall back rather than render an empty map.
  const [sessionId, setSessionId] = useState(() => {
    const linked = bookable.find((s) => s.id === initialSessionId);
    if (linked && !closed(linked)) return linked.id;
    // Default to one that can actually be bought, falling back to the first so
    // an all-closed event still renders its (refused) state rather than blank.
    return (bookable.find((s) => !closed(s)) ?? bookable[0])?.id ?? "";
  });
  const [ticketId, setTicketId] = useState(initialTicketId);
  // Seeded, not locked: plenty of people buy tickets for someone else.
  const [name, setName] = useState(viewer?.fullName ?? "");
  const [phone, setPhone] = useState(viewer?.phone ?? "");
  const [quantity, setQuantity] = useState("1");
  const [seats, setSeats] = useState<SeatDetail[]>([]);
  const [standing, setStanding] = useState<StandingSelection | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [requiresPayment, setRequiresPayment] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderCode, setOrderCode] = useState<string | null>(null);
  /** Set once the gateway URL is in hand; renders the code, then leaves. */
  const [handoff, setHandoff] = useState<{ code: string; url: string } | null>(
    null,
  );
  const [pending, setPending] = useState<PendingOrder | null>(null);
  const [resuming, setResuming] = useState(false);
  /** The soonest hold deadline, reported upward by the map. */
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null);

  const [promo, setPromo] = useState("");
  const [applied, setApplied] = useState<AppliedDiscount | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const session = bookable.find((s) => s.id === sessionId);
  const layoutVersionId = session?.layoutVersionId;
  const assigned = Boolean(layoutVersionId);

  const ticket = tickets.find((t) => t.id === ticketId) ?? tickets[0];
  const maxQty = Math.min(ticket?.capacity ?? 0, 10);
  const qtyNum = Number.parseInt(quantity, 10) || 0;

  // A mapped session can hold both at once: numbered seats in the stands and a
  // plain quantity on the standing floor.
  const standingTotal = (standing?.price ?? 0) * (standing?.quantity ?? 0);
  const subtotal = assigned
    ? seats.reduce((sum, s) => sum + (s.price ?? 0), 0) + standingTotal
    : (ticket?.price ?? 0) * (qtyNum > 0 ? qtyNum : 0);

  /**
   * Do we actually know what this costs?
   *
   * A seat's price comes from the *availability* response, which is a separate
   * fetch from the seat geometry — so a seat can be selected before its price
   * is known, and `s.price ?? 0` quietly counted it as free. That is not merely
   * a wrong number in the summary: `total === 0` also flips the button from
   * «پرداخت» to «دریافت بلیت», so the call to action told the buyer the order
   * was free and the server then charged them for it.
   *
   * A failed availability request makes it permanent rather than momentary.
   *
   * A genuinely free seated event is unaffected — its seats carry a price of
   * `0`, which is a number, so the total stays known and the button still
   * correctly reads «دریافت بلیت».
   */
  const priceKnown =
    !assigned || seats.every((s) => typeof s.price === "number");

  /**
   * Is there anything in the basket at all?
   *
   * `seats.every(...)` is vacuously `true` on an empty array, so an untouched
   * seated checkout had a *confidently known* price of zero: «جمع: رایگان»,
   * «قابل پرداخت: رایگان», and a button reading «دریافت بلیت» — on a concert
   * whose cheapest seat is ۲٬۸۰۰٬۰۰۰ تومان. That is the state every seated
   * buyer starts in, so it was also the first thing they ever read here.
   *
   * `priceKnown` above was written for the neighbouring bug — a seat selected
   * before its price arrived — and structurally cannot catch this one. There
   * the question is "do we know the total yet"; here it is "is there a total to
   * know". An empty basket has no price to wait for, so no amount of waiting
   * fixes the answer.
   */
  const hasBasket = assigned
    ? seats.length > 0 || standing !== null
    : qtyNum > 0;

  const discountAmount = discountFor(applied, subtotal);
  const total = subtotal - discountAmount;

  /**
   * The same clock the map shows, rendered where the money is.
   *
   * Read-only here: the map owns expiry and the recovery that follows it, so
   * this passes no `onExpire`. Two views of one deadline, not two deadlines.
   */
  const hold = useHoldTimer(holdExpiresAt);
  const holdVisible = hold.phase === "ok" || hold.phase === "warning";

  // Bumped when the server refuses the order over seats, so the map re-checks
  // itself instead of contradicting the error message above it.
  const [seatResync, setSeatResync] = useState(0);

  // Identity-stable, or SeatMap's effect re-runs on every render.
  const onSelectionChange = useCallback((next: SeatDetail[]) => setSeats(next), []);
  const onStandingChange = useCallback(
    (next: StandingSelection | null) => setStanding(next),
    [],
  );
  const onHoldChange = useCallback(
    (next: string | null) => setHoldExpiresAt(next),
    [],
  );

  const forgetPending = useCallback(() => {
    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch {
      // Private mode, or storage disabled. The banner still clears.
    }
    setPending(null);
  }, []);

  /**
   * Did the buyer already start paying for this event?
   *
   * Reached by pressing Back at the gateway, which returns a freshly mounted
   * form with every field blank — and, before this, no sign at all that an
   * order was already out there holding their seats. Pressing «پرداخت» again
   * simply made a second one.
   */
  useEffect(() => {
    let record: PendingOrder | null = null;
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      record = raw ? (JSON.parse(raw) as PendingOrder) : null;
    } catch {
      record = null;
    }
    if (!record) return;
    const lapsed = record.expiresAt
      ? Date.parse(record.expiresAt) <= Date.now()
      : false;
    // Another event's order is not this page's business, and an expired one is
    // nobody's — both would only offer a button that cannot work.
    if (record.eventId !== eventId || lapsed) {
      forgetPending();
      return;
    }
    setPending(record);
  }, [eventId, forgetPending]);

  /**
   * Leave for the gateway — but only after a paint.
   *
   * `window.location.assign` fired straight out of the submit handler never let
   * React render, so the last thing the buyer saw of this site was the form
   * they had just filled in. They arrived at the gateway holding nothing: no
   * code, no record, no way to ask about the money if the payment half-failed.
   * The first frame schedules the paint; the second runs after it has landed.
   */
  useEffect(() => {
    if (!handoff) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => window.location.assign(handoff.url));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [handoff]);

  /** Hand the buyer off to the gateway, remembering the order first. */
  const beginPayment = useCallback(
    (order: PendingOrder, redirectUrl: string) => {
      try {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(order));
      } catch {
        // Storage refused. The interstitial below still shows the code, which
        // is the part the buyer needs in hand.
      }
      setHandoff({ code: order.code, url: redirectUrl });
    },
    [],
  );

  /** Resume the payment the buyer walked away from, rather than duplicate it. */
  async function resumePending() {
    if (!pending) return;
    setResuming(true);
    setErrors({});
    try {
      const res = await fetch(`/api/orders/${pending.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: pending.phone }),
      });
      const json = await res.json();
      if (!res.ok || !("data" in json)) {
        // Paid, cancelled, or swept. Nothing to resume, and leaving the banner
        // up would only invite the buyer to keep pressing a dead button.
        setErrors({
          form: json?.error?.message ?? "این سفارش دیگر قابل پرداخت نیست.",
        });
        forgetPending();
        return;
      }
      beginPayment(pending, json.data.redirectUrl as string);
    } catch {
      setErrors({ form: "ارتباط با سرور برقرار نشد. دوباره تلاش کنید." });
    } finally {
      setResuming(false);
    }
  }

  async function applyPromo() {
    const code = promo.trim();
    if (!code) return;
    setPromoLoading(true);
    setPromoError(null);
    try {
      const res = await fetch("/api/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, eventId, sessionId, subtotal }),
      });
      const json = (await res.json()) as { data?: DiscountValidation };
      const result = json.data;
      if (result && result.ok) {
        setApplied({ code: result.code, kind: result.kind, value: result.value });
        setPromoError(null);
      } else {
        setApplied(null);
        setPromoError(result?.reason ?? "کد تخفیف معتبر نیست.");
      }
    } catch {
      setPromoError("خطا در بررسی کد تخفیف. دوباره تلاش کنید.");
    } finally {
      setPromoLoading(false);
    }
  }

  function removePromo() {
    setApplied(null);
    setPromo("");
    setPromoError(null);
  }

  async function submit() {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "نام و نام خانوادگی الزامی است.";
    if (!/^(\+98|0)?9\d{9}$/.test(normalisePhone(phone))) {
      next.phone = "شماره موبایل معتبر وارد کنید.";
    }
    if (assigned) {
      // Either is a valid basket — seats, standing, or both.
      if (!seats.length && !standing) {
        next.seats = "حداقل یک صندلی یا بلیت ایستاده انتخاب کنید.";
      }
    } else if (qtyNum < 1 || qtyNum > maxQty) {
      next.quantity = `تعداد باید بین ۱ و ${formatNumber(maxQty)} باشد.`;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      // Seats travel grouped by section; the server resolves each to its ticket
      // type and price. Nothing about cost is sent from here.
      const bySection = new Map<string, number[]>();
      for (const seat of seats) {
        bySection.set(seat.section, [
          ...(bySection.get(seat.section) ?? []),
          seat.index,
        ]);
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          ...(sessionId ? { sessionId } : {}),
          ...(assigned
            ? {
                seats: [...bySection.entries()].map(([section, list]) => ({
                  section,
                  seats: list,
                })),
                // Standing travels as an ordinary line; the server merges it
                // with the seat lines into one basket.
                ...(standing
                  ? {
                      items: [
                        {
                          ticketTypeId: standing.ticketTypeId,
                          quantity: standing.quantity,
                        },
                      ],
                    }
                  : {}),
              }
            : { items: [{ ticketTypeId: ticket.id, quantity: qtyNum }] }),
          buyerName: name.trim(),
          buyerPhone: normalisePhone(phone),
          ...(applied ? { discountCode: applied.code } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !("data" in json)) {
        setErrors({ form: json?.error?.message ?? "ثبت سفارش انجام نشد. دوباره تلاش کنید." });
        /**
         * Seat refusals need the map told, not just the buyer.
         *
         * Every failure used to land in the same `form` error and stop there,
         * which is fine for a bad phone number and wrong for these two: the
         * seats stay lit and selected under a message saying they are gone, and
         * pressing the button again reproduces it exactly. The two clocks
         * genuinely disagree — `releaseExpiredOrders` sweeps at the top of
         * `createOrder`, so the request that reads a hold can be the one that
         * expires it — so the client cannot prevent this, only recover from it.
         */
        if (needsSeatResync(json?.error?.code)) setSeatResync((n) => n + 1);
        return;
      }
      const order = json.data.order as {
        id: string;
        code: string;
        expiresAt?: string;
      };

      // A free order is already settled; there is nothing to pay, and a
      // gateway would reject a zero amount.
      if (!json.data.requiresPayment) {
        forgetPending();
        setOrderCode(order.code);
        setRequiresPayment(false);
        return;
      }

      // Guest checkout has no session, so the order's own phone is the proof.
      // In the body, not the query: a phone number in a URL lands in the access
      // log, the browser history and any outbound `Referer`.
      const payRes = await fetch(`/api/orders/${order.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalisePhone(phone) }),
      });
      const payJson = await payRes.json();
      if (!payRes.ok || !("data" in payJson)) {
        setErrors({
          form:
            payJson?.error?.message ??
            "اتصال به درگاه پرداخت ممکن نشد؛ سفارش شما رزرو است.",
        });
        // The order exists and holds its seats, so the code is still useful —
        // and worth remembering, so a reload offers to finish it rather than
        // starting a second one over the same seats.
        try {
          sessionStorage.setItem(
            PENDING_KEY,
            JSON.stringify({
              id: order.id,
              code: order.code,
              eventId,
              phone: normalisePhone(phone),
              expiresAt: order.expiresAt,
            } satisfies PendingOrder),
          );
        } catch {
          // Storage refused; the code is on screen either way.
        }
        setOrderCode(order.code);
        setRequiresPayment(true);
        return;
      }
      beginPayment(
        {
          id: order.id,
          code: order.code,
          eventId,
          phone: normalisePhone(phone),
          expiresAt: order.expiresAt,
        },
        payJson.data.redirectUrl as string,
      );
      return;
    } catch {
      setErrors({ form: "ارتباط با سرور برقرار نشد. دوباره تلاش کنید." });
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * The last thing the buyer sees before the gateway.
   *
   * Its whole job is the tracking code. A payment that half-fails — a closed
   * tab, a dead phone, a gateway that never returns — leaves someone who has
   * possibly been charged eleven million Toman with nothing to quote to anyone.
   * The code is the recovery path, and it has to be handed over *before* the
   * risky step, not after it succeeds.
   */
  if (handoff) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <Loader2
          className="mx-auto size-6 animate-spin text-muted motion-reduce:animate-none"
          aria-hidden
        />
        <p className="mt-4 text-sm text-muted">در حال انتقال به درگاه پرداخت…</p>
        <p className="mt-5 text-xs text-faint">کد پیگیری شما</p>
        <p className="mt-1 text-2xl font-bold tracking-wider text-foreground">
          {handoff.code}
        </p>
        <p className="mx-auto mt-3 max-w-sm text-xs leading-relaxed text-muted">
          این کد را نگه دارید. اگر پرداخت نیمه‌کاره ماند، سفارش شما با همین کد
          پیگیری می‌شود.
        </p>
      </div>
    );
  }

  if (orderCode) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <span className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-success/10 text-success-text">
          <CheckCircle2 className="size-8" aria-hidden />
        </span>
        <h2 className="text-xl font-bold text-foreground">سفارش شما ثبت شد</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          {`کد پیگیری: ${orderCode} — «${eventTitle}»`}
        </p>
        {seats.length ? (
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
            {seats
              .map((s) => `${s.sectionName} ردیف ${s.rowLabel} صندلی ${s.seatLabel}`)
              .join("، ")}
          </p>
        ) : null}
        {applied ? (
          <p className="mx-auto mt-1 max-w-sm text-xs text-success-text">
            {`کد تخفیف «${applied.code}» اعمال شد؛ مبلغ پرداختی ${formatToman(total)}.`}
          </p>
        ) : null}
        {/*
          Neither branch may claim more than it knows.

          «پیامک تأیید برایتان ارسال شد» was asserted in the past tense about a
          send that is `void notifyOrderPaid(...)` — fire-and-forget, its result
          discarded before it could reach a client, and a no-op entirely when no
          SMS provider is configured. Telling the buyer to keep the code on
          screen is true whatever the operator did, and it is the same code the
          door accepts when their phone has no signal.

          The other branch is reached when the *gateway* failed to start, and it
          said online payment «به‌زودی فعال می‌شود» — soon to be enabled. It is
          enabled; this attempt failed. Worse, "reserved until then" reads as
          indefinite, while the order expires with its seats in minutes. A buyer
          who came back later found neither.
        */}
        <p className="mx-auto mt-1 max-w-sm text-xs text-faint">
          {requiresPayment
            ? "اتصال به درگاه پرداخت انجام نشد. سفارش شما فقط برای مدت کوتاهی رزرو می‌ماند؛ برای تکمیل پرداخت دوباره اقدام کنید."
            : "بلیت شما صادر شد. این کد پیگیری را نگه دارید — در ورودی هم پذیرفته می‌شود."}
        </p>
        <div className="mt-6 flex items-center justify-center gap-4">
          <Link
            href="/me/tickets"
            className="text-sm font-medium text-accent-text underline-offset-4 hover:underline"
          >
            بلیت‌های من
          </Link>
          <Link
            href={`/events/${eventId}`}
            className="text-sm font-medium text-muted underline-offset-4 hover:text-foreground hover:underline"
          >
            بازگشت به رویداد
          </Link>
        </div>
      </div>
    );
  }

  /**
   * What is actually being bought.
   *
   * The page used to name it nowhere. `eventTitle` was threaded in and spent on
   * the success screen alone, so between arriving and paying there was no title,
   * no date, no venue — and for a one-off event the سانس picker is hidden too,
   * so not even the showing was stated. A buyer following a deep link from an
   * SMS has never seen the event page at all: they were being asked for money
   * for an unnamed thing, and two open tabs were indistinguishable.
   */
  const heading = [
    session ? formatJalaliDate(session.startAt) : null,
    session ? `ساعت ${formatTime(session.startAt)}` : null,
    eventVenue,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      {/*
        A `div`, not a `header`. This is the page's title block, and marking it
        up as a header put a second `banner` landmark inside `main` — under the
        site header, which is the real one. The `h1` carries the structure; the
        element around it does not need to claim a role as well.
      */}
      <div className="flex flex-col gap-2">
        <Link
          href={`/events/${eventId}`}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowRight className="size-4" aria-hidden />
          بازگشت به رویداد
        </Link>
        <h1 className="text-xl font-bold text-balance text-foreground sm:text-2xl">
          {eventTitle}
        </h1>
        {heading.length ? (
          <p className="text-sm text-muted">{heading.join(" · ")}</p>
        ) : null}
      </div>

      {pending ? (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="text-sm font-bold text-warning-text">
              سفارش در انتظار پرداخت دارید
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {`کد پیگیری ${pending.code} — تا وقتی پرداخت نشده، صندلی‌های آن برای شما رزرو است. سفارش تازه ثبت نکنید.`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" onClick={resumePending} disabled={resuming}>
              {resuming ? (
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
              ) : (
                "ادامه پرداخت"
              )}
            </Button>
            <Button size="sm" variant="secondary" onClick={forgetPending}>
              انصراف
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          {bookable.length > 1 ? (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-3 text-sm font-bold text-foreground">سانس</h2>
              <div className="flex flex-wrap gap-2">
                {bookable.map((s) => {
                  const shut = closed(s);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={shut}
                      aria-pressed={s.id === sessionId}
                      onClick={() => {
                        setSessionId(s.id);
                        // Seats belong to a showing; keeping them across a change
                        // would submit seats from a session nobody chose.
                        setSeats([]);
                        // So does a سانس-scoped discount. Carrying it over shows
                        // a price the server will refuse at submit.
                        setApplied(null);
                        setPromoError(null);
                      }}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-start text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                        shut
                          ? "cursor-not-allowed border-border bg-subtle text-faint"
                          : s.id === sessionId
                            ? "border-accent bg-accent-soft text-accent-text"
                            : "border-border hover:border-accent",
                      )}
                    >
                      <span className="block font-medium">
                        {formatJalaliDate(s.startAt)}
                      </span>
                      {/* No `opacity-75` here: it dims whatever colour it lands
                          on without knowing what that is, and this button has
                          three of them. On the selected state it took
                          accent-text from 4.52 to 3.41, and on a closed سانس
                          faint from 4.63 to 2.93 — both below AA, on the line
                          that says what time the show starts. The size step from
                          `text-sm` already carries the hierarchy. */}
                      <span className="block text-xs">
                        ساعت {formatTime(s.startAt)}
                      </span>
                      {s.availability && s.availability !== "available" ? (
                        <span className="mt-0.5 block text-[11px]">
                          {SESSION_AVAILABILITY_LABELS[s.availability]}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {assigned && layoutVersionId ? (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-1 text-sm font-bold text-foreground">
                انتخاب صندلی
              </h2>
              <p className="mb-4 text-xs text-muted">
                روی نقشه یک بخش را انتخاب کنید، سپس صندلی‌های خود را بزنید.
              </p>
              <SeatMap
                sessionId={sessionId}
                layoutVersionId={layoutVersionId}
                onSelectionChange={onSelectionChange}
                onStandingChange={onStandingChange}
                onHoldChange={onHoldChange}
                resyncNonce={seatResync}
              />
              {/* `role="alert"`: this is the likeliest failure in the seated flow
                  and it renders far from the button that triggered it, so a
                  screen reader was the only reader never told. */}
              {errors.seats ? (
                <p role="alert" className="mt-3 text-xs text-danger-text">
                  {errors.seats}
                </p>
              ) : null}
            </section>
          ) : (
            <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
              <Field id="ticket" label="نوع بلیت">
                <Select
                  id="ticket"
                  value={ticketId}
                  onChange={(e) => setTicketId(e.target.value)}
                >
                  {tickets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {CATEGORY_LABELS[t.category]} · {formatToman(t.price)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                id="quantity"
                label="تعداد"
                error={errors.quantity}
                hint={`حداکثر ${formatNumber(maxQty)} بلیت در هر سفارش`}
              >
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  max={maxQty}
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </Field>
            </section>
          )}

          <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold text-foreground">مشخصات خریدار</h2>

            <Field id="name" label="نام و نام خانوادگی" required error={errors.name}>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="نام کامل"
              />
            </Field>

            <Field
              id="phone"
              label="شماره موبایل"
              required
              error={errors.phone}
              hint="بلیت و کد پیگیری به این شماره پیامک می‌شود."
            >
              <Input
                id="phone"
                dir="ltr"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09xxxxxxxxx"
              />
            </Field>
          </section>
        </div>

        {/* Summary */}
        <aside className="flex h-fit flex-col gap-4 rounded-xl border border-border bg-card p-5 lg:sticky lg:top-6">
          <h2 className="text-sm font-bold text-foreground">خلاصه سفارش</h2>

          {assigned && standing ? (
            <div className="flex justify-between gap-2 text-xs text-muted">
              <span>
                {standing.sectionName} × {formatNumber(standing.quantity)}
              </span>
              <span className="tabular-nums">{formatToman(standingTotal)}</span>
            </div>
          ) : null}

          {assigned ? (
            seats.length ? (
              <ul className="flex flex-col gap-1.5 text-xs text-muted">
                {seats.map((s) => (
                  <li key={`${s.section}-${s.index}`} className="flex justify-between gap-2">
                    <span>
                      {formatSeat({ section: s.sectionName, row: s.rowLabel, number: s.seatLabel })}
                    </span>
                    <span className="tabular-nums">{formatToman(s.price ?? 0)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              standing ? null : (
                <p className="flex items-center gap-2 text-xs text-faint">
                  <TicketIcon className="size-4" aria-hidden />
                  هنوز صندلی‌ای انتخاب نشده است.
                </p>
              )
            )
          ) : (
            <div className="flex justify-between text-xs text-muted">
              <span>
                {ticket?.name} × {formatNumber(qtyNum)}
              </span>
              <span className="tabular-nums">{formatToman(subtotal)}</span>
            </div>
          )}

          <div className="border-t border-border pt-4">
            {applied ? (
              <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-success/10 px-3 py-2 text-xs text-success-text">
                <span className="flex items-center gap-1.5">
                  <Tag className="size-3.5" aria-hidden />
                  {applied.code}
                </span>
                <button
                  type="button"
                  onClick={removePromo}
                  aria-label="حذف کد تخفیف"
                  className="rounded p-0.5 hover:bg-black/5"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
            ) : (
              <div className="mb-3 flex gap-2">
                <Input
                  aria-label="کد تخفیف"
                  value={promo}
                  onChange={(e) => setPromo(e.target.value)}
                  placeholder="کد تخفیف"
                  className="h-10"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={applyPromo}
                  disabled={promoLoading || !promo.trim() || subtotal <= 0}
                >
                  {promoLoading ? <Loader2 className="size-4 animate-spin" /> : "اعمال"}
                </Button>
              </div>
            )}
            {promoError ? (
              <p className="mb-3 text-xs text-danger-text">{promoError}</p>
            ) : null}

            {/*
              «—», not «رایگان», until something is in the basket.

              `formatToman(0)` renders «رایگان» by design, which is right for a
              free ticket and a lie for an empty basket. Both rows go through it,
              so both told a buyer with nothing selected that a paid concert cost
              nothing.
            */}
            <dl className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between text-muted">
                <dt>جمع</dt>
                <dd className="tabular-nums">
                  {hasBasket ? formatToman(subtotal) : "—"}
                </dd>
              </div>
              {discountAmount > 0 ? (
                <div className="flex justify-between text-success-text">
                  <dt>تخفیف</dt>
                  <dd className="tabular-nums">−{formatToman(discountAmount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold text-foreground">
                <dt>قابل پرداخت</dt>
                {!hasBasket ? (
                  <dd className="tabular-nums text-muted">—</dd>
                ) : priceKnown ? (
                  <dd className="tabular-nums">{formatToman(total)}</dd>
                ) : (
                  // A shimmer, not a confident «رایگان» — the price is still on
                  // its way, and guessing at it is how the wrong CTA appeared.
                  <dd className="w-24"><Skeleton className="h-5 w-full" /></dd>
                )}
              </div>
            </dl>
          </div>

          {/*
            The clock, next to the money.

            It renders in the map too, at 11px, above the whole buyer form — so on
            the layout that ships, the person typing their name and phone number
            could not see the countdown they were racing. `text-sm` here, and the
            same warning colour, because this is the copy of it that gets read.
          */}
          {holdVisible ? (
            <div className="flex flex-col gap-2">
              <p
                // Polite: an assertive region would interrupt a screen reader
                // every second.
                aria-live="polite"
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium tabular-nums",
                  hold.phase === "warning"
                    ? "bg-danger/10 text-danger-text"
                    : "bg-subtle text-muted",
                )}
              >
                <span>نگه‌داری صندلی</span>
                <span>{hold.label}</span>
              </p>
              {/*
                The old sentence promised the seats were held «تا پایان پرداخت» —
                until payment finishes. They are not: the seat hold runs out, and
                then the order does. Deferring to the clock above states the same
                reassurance without inventing a guarantee, and without copying a
                server constant into the client where it would drift.
              */}
              <p className="text-[11px] leading-relaxed text-faint">
                تا پایان این زمان صندلی‌ها برای شما نگه داشته می‌شود؛ پس از آن
                دوباره آزاد می‌شوند.
              </p>
            </div>
          ) : null}

          {errors.form ? (
            <p role="alert" className="text-xs text-danger-text">
              {errors.form}
            </p>
          ) : null}

          <Button
            onClick={submit}
            disabled={submitting || !priceKnown || !hasBasket}
            className="w-full"
          >
            {submitting
              ? "در حال ثبت…"
              : !hasBasket
                ? assigned
                  ? "ابتدا صندلی انتخاب کنید"
                  : "ابتدا تعداد را مشخص کنید"
                : !priceKnown
                  ? "در حال محاسبهٔ مبلغ…"
                  : total === 0
                    ? "دریافت بلیت"
                    : "پرداخت"}
          </Button>
        </aside>
      </div>
    </div>
  );
}
