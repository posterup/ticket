"use client";

import { use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Armchair, Ban, CheckCircle2, XCircle, Clock } from "lucide-react";

import { useApi } from "@/lib/client/api";
import { TicketQr } from "@/components/tickets/TicketQr";
import { AddToCalendar } from "@/components/tickets/AddToCalendar";
import { AsyncState } from "@/components/ui/async-state";
import { formatNumber, formatSeat, formatToman } from "@/lib/format";
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
          {settling ? (
            <p className="mx-auto mt-3 max-w-sm rounded-lg bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning-text">
              مبلغ از حساب شما کسر شده و پرداخت تأیید است، اما صدور بلیت کمی طول
              کشیده. این صفحه را چند دقیقهٔ دیگر تازه کنید؛ اگر بلیت صادر نشد با
              همین «کد پیگیری» با میزبان تماس بگیرید.
            </p>
          ) : null}
          <p className="mt-2 text-sm text-muted">{`کد پیگیری: ${order.code}`}</p>

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
            <div className="mt-1 flex justify-between gap-4 border-t border-border pt-2 font-semibold">
              <dt className="text-foreground">مبلغ</dt>
              <dd className="text-foreground">{formatToman(order.total)}</dd>
            </div>
          </dl>

          {paid && order.tickets.length ? (
            <section className="mt-7 border-t border-border pt-6 text-start">
              <h2 className="mb-3 text-center text-sm font-bold text-foreground">
                بلیت‌های شما
              </h2>
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

              <p className="mt-3 text-center text-[11px] leading-relaxed text-faint">
                این کدها را در ورودی نشان دهید. لینک این صفحه را با کسی به
                اشتراک نگذارید.
              </p>
            </section>
          ) : null}

          <div className="mt-7 flex flex-col gap-2">
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
