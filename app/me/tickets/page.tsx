"use client";

/**
 * The buyer's tickets.
 *
 * This is where checkout sends people, and it was linked before it existed.
 *
 * Each ticket carries its own QR — the door scans the token, not the order — so
 * a party of four gets four codes, and for assigned seating each names the seat
 * it admits to. Nothing here is a summary of the order; it is the thing you
 * hold up at the door.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Armchair,
  Ban,
  CalendarDays,
  MapPin,
  QrCode,
  Ticket as TicketIcon,
} from "lucide-react";

import { useApi } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { formatJalaliDate, formatSeat, formatTime, relativeDay } from "@/lib/format";
import { AsyncState } from "@/components/ui/async-state";
import { TicketQr } from "@/components/tickets/TicketQr";
import { TicketPreview } from "@/components/tickets/TicketPreview";
import { AddToCalendar } from "@/components/tickets/AddToCalendar";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import type { IssuedTicket } from "@/types";

const STATUS: Record<IssuedTicket["status"], { label: string; className: string }> = {
  issued: { label: "معتبر", className: "bg-success/10 text-success-text" },
  "checked-in": { label: "استفاده‌شده", className: "bg-subtle text-muted" },
  cancelled: { label: "لغو شده", className: "bg-subtle text-danger-text" },
  refunded: { label: "بازپرداخت", className: "bg-subtle text-muted" },
};

export default function MyTicketsPage() {
  const { data, error, loading, reload } = useApi<IssuedTicket[]>("/api/me/tickets");
  const [open, setOpen] = useState<string | null>(null);

  // Upcoming first; a ticket for tonight matters more than one from last year.
  const tickets = useMemo(() => {
    if (!data) return [];
    const now = Date.now();
    return [...data].sort((a, b) => {
      const ta = a.startAt ? new Date(a.startAt).getTime() : 0;
      const tb = b.startAt ? new Date(b.startAt).getTime() : 0;
      const aPast = ta && ta < now;
      const bPast = tb && tb < now;
      if (aPast !== bPast) return aPast ? 1 : -1;
      return aPast ? tb - ta : ta - tb;
    });
  }, [data]);

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-6 flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            بلیت‌های من
          </h1>
          <Link
            href="/me/orders"
            className="text-sm text-accent-text underline-offset-4 hover:underline"
          >
            سفارش‌های من
          </Link>
        </header>

        {!data ? (
          <AsyncState loading={loading} error={error} onRetry={reload} variant="list" rows={3}
            offlineHint="کد پیگیری را هنگام خرید و در پیامک تأیید دریافت کرده‌اید؛ همان را در ورودی بگویید. پذیرش با کد دستی هم انجام می‌شود."
          />
        ) : tickets.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <TicketIcon className="mx-auto mb-3 size-8 text-faint" aria-hidden />
            <p className="text-sm text-muted">هنوز بلیتی نخریده‌اید.</p>
            <Link
              href="/events"
              className="mt-4 inline-block text-sm font-medium text-accent-text underline-offset-4 hover:underline"
            >
              کاوش رویدادها
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {tickets.map((t) => {
              // A cancelled showing outranks the ticket's own status: the
              // ticket is still `issued` until someone refunds it, and «معتبر»
              // over a scannable code is the wrong thing to tell someone whose
              // show is not happening.
              const off = Boolean(t.showCancelled);
              const status = off
                ? { label: "لغو شده", className: "bg-danger/10 text-danger-text" }
                : STATUS[t.status];
              const showing = open === t.id && !off;
              const past = t.startAt ? new Date(t.startAt).getTime() < Date.now() : false;

              return (
                <li
                  key={t.id}
                  className={cn(
                    "overflow-hidden rounded-xl border border-border bg-card",
                    past && "opacity-70",
                  )}
                >
                  <div className="flex flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/events/${t.eventId}`}
                          className="text-base font-bold text-foreground underline-offset-4 hover:underline"
                        >
                          {t.eventTitle}
                        </Link>
                        <p className="mt-0.5 text-xs text-muted">
                          {t.ticketTypeName} · {t.holderName}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {/*
                          How soon, in words.
                          
                          The date below is exact and asks the reader to work
                          out the only thing they usually want: is this today?
                          A ticket for tonight and one for September were
                          distinguishable here by nothing but their place in
                          the list. Hidden for a cancelled showing — «فردا»
                          above «لغو شده» is a contradiction — and past a week,
                          where «۸۳ روز دیگر» is noise dressed as information.
                        */}
                        {!off && t.startAt && relativeDay(t.startAt) ? (
                          <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-text">
                            {relativeDay(t.startAt)}
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-xs font-medium",
                            status.className,
                          )}
                        >
                          {status.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 text-xs text-muted">
                      {t.startAt ? (
                        <p className="flex items-center gap-1.5">
                          <CalendarDays className="size-3.5 text-faint" aria-hidden />
                          {formatJalaliDate(t.startAt)} · ساعت {formatTime(t.startAt)}
                        </p>
                      ) : null}
                      {t.venueName ? (
                        <p className="flex items-center gap-1.5">
                          <MapPin className="size-3.5 text-faint" aria-hidden />
                          {t.venueName}
                        </p>
                      ) : null}
                      {t.seat ? (
                        <p className="flex items-center gap-1.5 font-medium text-foreground">
                          <Armchair className="size-3.5 text-accent-text" aria-hidden />
                          {formatSeat(t.seat)}
                        </p>
                      ) : null}
                    </div>

                    {off ? (
                      <p className="flex items-start gap-1.5 rounded-lg bg-danger/10 px-3 py-2 text-xs leading-relaxed text-danger-text">
                        <Ban className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        <span>
                          این برنامه لغو شده است و این بلیت اعتبار ورود ندارد.
                          مبلغ آن بازگردانده می‌شود؛ وضعیت را در «سفارش‌های من»
                          دنبال کنید.
                        </span>
                      </p>
                    ) : null}

                    <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                      <span className="text-xs text-faint">
                        کد پیگیری: {t.orderCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => setOpen(showing ? null : t.id)}
                        aria-expanded={showing}
                        // No code for a cancelled show: it would only send
                        // someone to a door that is not opening.
                        disabled={t.status !== "issued" || off}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                          t.status === "issued"
                            ? "text-accent-text hover:bg-subtle"
                            : "cursor-not-allowed text-faint",
                        )}
                      >
                        <QrCode className="size-4" aria-hidden />
                        {off ? "بدون کد ورود" : showing ? "بستن" : "نمایش کد ورود"}
                      </button>
                    </div>
                  </div>

                  {showing ? <TicketCode ticket={t} /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
}

/**
 * The scannable code, plus the token it encodes.
 *
 * Both, always. The QR is what a door scanner reads in a second; the text is
 * what gets someone in when the camera will not focus, the screen is cracked,
 * or the scanner has gone flat — and `/dashboard/checkin` accepts a typed token
 * precisely so that fallback is real rather than decorative.
 */
function TicketCode({ ticket }: { ticket: IssuedTicket }) {
  const token = ticket.qrToken;
  const design = ticket.design;

  return (
    <div className="border-t border-border bg-subtle p-5 text-center">
      <p className="mb-3 text-xs text-muted">این کد را در ورودی نشان دهید</p>

      {/*
        When the organiser designed a ticket, this is where it shows up.
        «قالب بلیت» was a dashboard tool whose output went nowhere: it was never
        persisted and the buyer never saw it. The designed ticket carries its
        own QR, so the plain plate below is only for events with no template.
      */}
      {design ? (
        <div className="mx-auto mb-4 max-w-sm text-start">
          <TicketPreview
            template={{
              accent: design.accent ?? "#2563EB",
              surface: design.surface ?? "light",
              bgColor: design.bgColor ?? null,
              bgImage: design.bgImage ?? null,
              logo: design.logo ?? null,
              showCategory: design.showCategory ?? false,
              showDate: design.showDate ?? true,
              showVenue: design.showVenue ?? true,
              note: design.note ?? "",
            }}
            sample={{
              eventTitle: ticket.eventTitle,
              holder: ticket.holderName,
              category: ticket.ticketTypeName,
              date: ticket.startAt
                ? `${formatJalaliDate(ticket.startAt)} · ${formatTime(ticket.startAt)}`
                : "",
              venue: ticket.venueName ?? "",
              // Assigned seating only; open seating has no seat to print.
              ...(ticket.seat
                ? {
                    seat: formatSeat(ticket.seat),
                  }
                : {}),
              qrToken: token,
            }}
          />
        </div>
      ) : null}

      {/* White plate under the code: the page background is near-white but not
          white, and a QR wants a true quiet zone to sit in. Skipped when the
          designed ticket above already carries one — two codes on one screen is
          an invitation to scan the wrong one. */}
      {design ? null : (
        <div className="mx-auto w-fit rounded-xl bg-white p-3 shadow-sm">
          <TicketQr token={token} size={196} />
        </div>
      )}

      <p
        dir="ltr"
        className="mx-auto mt-3 max-w-full break-all rounded-lg bg-[var(--field-background)] px-4 py-2.5 font-mono text-xs font-bold tracking-wider text-foreground"
      >
        {token}
      </p>
      <p className="mt-2 text-[11px] text-faint">
        کد اختصاصی این بلیت است؛ آن را با کسی به اشتراک نگذارید.
      </p>

      {/* Most of a ticket's value arrives as a reminder the evening before. */}
      <div className="mt-3 flex justify-center">
        <AddToCalendar ticket={ticket} />
      </div>
    </div>
  );
}
