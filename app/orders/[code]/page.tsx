"use client";

import { use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Armchair,
  Ban,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
} from "lucide-react";

import { useApi } from "@/lib/client/api";
import { TicketQr } from "@/components/tickets/TicketQr";
import { AddToCalendar } from "@/components/tickets/AddToCalendar";
import { AsyncState } from "@/components/ui/async-state";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import {
  formatJalaliDate,
  formatNumber,
  formatSeat,
  formatTime,
  formatToman,
} from "@/lib/format";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import type { IssuedTicket, Order } from "@/types";

/** The order plus what it issued, so a guest can reach their entry codes. */
type OrderResult = Order & { tickets: IssuedTicket[] };

/**
 * Where the gateway returns the buyer.
 *
 * Reached by tracking code rather than id, so it can be shared and revisited
 * without a session — a guest checkout has no account to look it up under.
 */
export default function OrderResultPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const state = useSearchParams().get("state");
  const { data: order, error, loading, reload } = useApi<OrderResult>(
    `/api/orders/by-code/${code}`,
  );

  if (!order) {
    return (
      <div className="flex min-h-[100dvh] flex-col">
        <PublicHeader />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-12 sm:px-6">
          <AsyncState loading={loading} error={error} onRetry={reload} variant="page" rows={1}
            offlineHint="کد پیگیری را هنگام خرید و در پیامک تأیید دریافت کرده‌اید؛ همان را در ورودی بگویید. پذیرش با کد دستی هم انجام می‌شود."
          />
        </main>
        <Footer />
      </div>
    );
  }

  const failed = state === "failed" || order.status === "failed";
  const paid = order.status === "paid";
  /**
   * Paid, but the settlement write did not land.
   *
   * The callback sets this after the operator confirmed the charge and
   * `markOrderPaid` then threw — see the note there. The order still reads
   * `pending`, so without this the buyer would be shown «در انتظار پرداخت»
   * about money that has already left their account.
   */
  const settling = state === "settling" && !paid;

  const tone = paid
    ? { Icon: CheckCircle2, className: "bg-success/10 text-success-text" }
    : failed
      ? { Icon: XCircle, className: "bg-danger/10 text-danger-text" }
      : { Icon: Clock, className: "bg-subtle text-muted" };
  const { Icon } = tone;

  /**
   * What was actually bought.
   *
   * This page named the tracking code, the line items and the amount, and never
   * once named the event: someone who had just paid eleven million Toman for a
   * concert could not read its title, its date, or where to go, and had to open
   * the calendar button to find out when to turn up.
   *
   * Every field is already loaded — `IssuedTicket` carries `eventTitle`,
   * `startAt` and `venueName`, so this is a rendering gap rather than a missing
   * fetch. It resolves only once tickets exist, which is to say only for a paid
   * order; `Order` itself carries no title, so a pending or failed order still
   * cannot say what it was for. That needs the API, not copy.
   */
  const bought = order.tickets[0];
  const boughtMeta = bought
    ? [
        bought.startAt ? formatJalaliDate(bought.startAt) : null,
        bought.startAt ? `ساعت ${formatTime(bought.startAt)}` : null,
        bought.venueName,
      ].filter(Boolean)
    : [];

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-12 sm:px-6">
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <span
            className={`mx-auto mb-5 grid size-14 place-items-center rounded-full ${tone.className}`}
          >
            <Icon className="size-8" aria-hidden />
          </span>
          <h1 className="text-xl font-bold text-foreground">
            {paid
              ? "پرداخت انجام شد"
              : settling
                ? "پرداخت دریافت شد"
                : failed
                  ? "پرداخت انجام نشد"
                  : "در انتظار پرداخت"}
          </h1>
          {/* The heading says what happened; this says what it happened to. */}
          {bought ? (
            <div className="mt-2">
              <p className="text-base font-medium text-balance text-foreground">
                {bought.eventTitle}
              </p>
              {boughtMeta.length ? (
                <p className="mt-1 text-sm text-muted">
                  {boughtMeta.join(" · ")}
                </p>
              ) : null}
            </div>
          ) : null}

          {settling ? (
            <p className="mx-auto mt-3 max-w-sm rounded-lg bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning-text">
              مبلغ از حساب شما کسر شده و پرداخت تأیید است، اما صدور بلیت کمی طول
              کشیده. این صفحه را چند دقیقهٔ دیگر تازه کنید؛ اگر بلیت صادر نشد با
              همین «کد پیگیری» با میزبان تماس بگیرید.
            </p>
          ) : null}

          {/*
            A failed payment used to be a dead end: a red cross, «پرداخت انجام
            نشد», and nothing about the two things the buyer needs to know.

            The first is the money. `state=failed` is reached both when the
            buyer abandoned the gateway and when verification failed, and the
            callback cannot tell which — so this promises a reversal *if* an
            amount was taken, and never asserts that one was.

            The second is the seats. `releaseAndFail` puts them back on sale
            immediately rather than at the hold's expiry, so "try again" means
            picking again. Saying so is what makes the button below honest.
          */}
          {failed ? (
            <p className="mx-auto mt-3 max-w-sm rounded-lg bg-danger/10 px-3 py-2 text-xs leading-relaxed text-danger-text">
              پرداخت کامل نشد، بنابراین بلیت‌های این سفارش دوباره به فروش گذاشته
              شد. اگر مبلغی از حساب شما کسر شده باشد، تا ۷۲ ساعت به‌صورت خودکار
              برمی‌گردد.
            </p>
          ) : null}

          {/*
            An order awaiting payment is on a clock, and the page never showed
            it. `/me/orders` already says this — same sentence, so a buyer who
            sees both reads one rule rather than two.
          */}
          {!paid && !failed && !settling ? (
            <p className="mx-auto mt-3 max-w-sm rounded-lg bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning-text">
              تا {formatTime(order.expiresAt)} فرصت پرداخت دارید. پس از آن سفارش
              لغو می‌شود و بلیت‌ها دوباره به فروش می‌رود.
            </p>
          ) : null}

          <p className="mt-3 text-xs text-faint">کد پیگیری</p>
          <p
            dir="ltr"
            className="font-mono text-lg font-bold tracking-wider text-foreground"
          >
            {order.code}
          </p>

          <dl className="mt-6 flex flex-col gap-2 text-sm">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-4">
                <dt className="text-muted">
                  {item.ticketTypeName} × {formatNumber(item.quantity)}
                </dt>
                <dd className="text-foreground">
                  {formatToman(item.unitPrice * item.quantity)}
                </dd>
              </div>
            ))}
            {order.discountAmount > 0 ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">تخفیف</dt>
                <dd className="text-success-text">{`− ${formatToman(order.discountAmount)}`}</dd>
              </div>
            ) : null}
            {/*
              «مبلغ» said neither which amount nor whether it had moved.

              Three states, three different facts. Paid: the thing they came to
              confirm. Awaiting payment: still owed, and «قابل پرداخت» is the
              phrase they read on the checkout summary minutes earlier. Failed:
              neither — this order is over and its inventory is already back on
              sale, so calling the figure «قابل پرداخت» would invite them to go
              looking for a pay button that is deliberately not there.
            */}
            <div className="mt-1 flex justify-between gap-4 border-t border-border pt-2 font-semibold">
              <dt className="text-foreground">
                {paid || settling
                  ? "مبلغ پرداخت‌شده"
                  : failed
                    ? "مبلغ سفارش"
                    : "قابل پرداخت"}
              </dt>
              <dd className="text-foreground">{formatToman(order.total)}</dd>
            </div>
          </dl>

          {paid && order.tickets.length ? (
            <section className="mt-7 border-t border-border pt-6 text-start">
              <h2 className="mb-1 text-center text-sm font-bold text-foreground">
                بلیت‌های شما
              </h2>
              {/*
                Moved above the codes from an 11px line underneath them, where
                it shared a sentence with the sharing warning. Two instructions
                in one breath, arriving after the thing they describe: this one
                is what to do with the codes, so it belongs before them.
              */}
              <p className="mb-3 text-center text-xs text-muted">
                این کد را در ورودی نشان دهید.
              </p>
              <ul className="flex flex-col gap-3">
                {order.tickets.map((t, i) => (
                  <li
                    key={t.id}
                    className="rounded-lg border border-border bg-subtle p-3"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-medium text-foreground">
                        بلیت {formatNumber(i + 1)} · {t.ticketTypeName}
                      </span>
                      {t.seat ? (
                        <span className="flex items-center gap-1 text-xs text-accent-text">
                          <Armchair className="size-3.5" aria-hidden />
                          {formatSeat(t.seat)}
                        </span>
                      ) : null}
                    </div>
                    {t.showCancelled ? (
                      // Printed or not, a code for a cancelled show only sends
                      // someone to a door that is not opening.
                      <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-danger/10 px-3 py-2 text-xs leading-relaxed text-danger-text">
                        <Ban className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        <span>
                          این برنامه لغو شده است؛ این بلیت اعتبار ورود ندارد و
                          مبلغ آن بازگردانده می‌شود.
                        </span>
                      </p>
                    ) : (
                    <>
                    {/* The order page is what a buyer prints, so the code has
                        to be on the paper — not only in the app. */}
                    <div className="mt-3 flex flex-col items-center gap-2">
                      <div className="qr-plate rounded-lg bg-white p-2.5 shadow-sm">
                        <TicketQr token={t.qrToken} size={148} />
                      </div>
                      <p
                        dir="ltr"
                        /*
                          `text-xs`, matching the wallet — and `ticket-token`,
                          which the print stylesheet enlarges further.

                          This was `text-[11px]`, the smallest type anywhere in
                          the product, on the string a person types at a door
                          when the camera will not focus. It was also *smaller*
                          than the identical token in `/me/tickets`, on the copy
                          that gets printed: paper has no zoom, and a monospace
                          alphanumeric being transcribed under pressure is the
                          last thing to shrink.
                        */
                        className="ticket-token w-full break-all rounded-md bg-[var(--field-background)] px-3 py-2 text-center font-mono text-xs font-bold tracking-wider text-foreground"
                      >
                        {t.qrToken}
                      </p>
                    </div>
                    </>
                    )}
                  </li>
                ))}
              </ul>
              {order.tickets[0] ? (
                <div className="mt-4 flex justify-center">
                  <AddToCalendar ticket={order.tickets[0]} />
                </div>
              ) : null}

              {/*
                A real warning, not a footnote. This link is a bearer token —
                anyone holding it holds the tickets — and it was the tail of a
                two-idea sentence set in the smallest type on the page, below
                the codes, i.e. after the reader had already decided whether to
                screenshot and forward it.
              */}
              <p className="mt-4 flex items-start gap-1.5 rounded-lg bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning-text">
                <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>
                  این صفحه حکم بلیت شما را دارد. لینک آن را برای کسی نفرستید.
                </span>
              </p>
            </section>
          ) : null}

          <div className="mt-7 flex flex-col gap-3">
            {/*
              The inventory is already back on sale, so the only real recovery
              is to start again — and it is the primary action, not a link
              buried under «بازگشت به رویداد». The سانس travels with it so the
              buyer lands on the showing they were already trying to buy.

              «خرید دوباره» rather than «انتخاب دوبارهٔ صندلی»: this page cannot
              tell whether the order had seats. A failed order has issued no
              tickets, so `tickets[0].seat` — the only seating signal here — is
              never there to read, and an open-seating event has no seats to
              re-pick in the first place.
            */}
            {failed ? (
              <Link
                href={`/events/${order.eventId}/checkout${
                  order.sessionId ? `?session=${order.sessionId}` : ""
                }`}
                className={cn(buttonVariants({ size: "md" }), "w-full")}
              >
                خرید دوباره
              </Link>
            ) : null}
            {paid ? (
              <Link
                href="/me/tickets"
                className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
              >
                مشاهدهٔ بلیت‌های من
              </Link>
            ) : null}
            <Link
              href={`/events/${order.eventId}`}
              className="text-sm font-medium text-muted underline-offset-4 hover:text-foreground hover:underline"
            >
              بازگشت به رویداد
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
