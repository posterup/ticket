"use client";

import Link from "next/link";
import { CalendarDays, Armchair, Ticket as TicketIcon } from "lucide-react";

import { useApi } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import {
  formatJalaliDate,
  formatNumber,
  formatSeat,
  formatTime,
  relativeDay,
} from "@/lib/format";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import type { IssuedTicket } from "@/types";

/**
 * The tickets a buyer is holding, on the page they land on.
 *
 * `/me` used to open with an empty box explaining how to bookmark an event —
 * housekeeping for a feature nobody arrives wanting. What someone actually
 * opens this page for is the thing they paid for, and that lived one tap away
 * at `/me/tickets` with no sign from here that it existed.
 *
 * A *preview*, not a second copy of that page: the three nearest tickets, no QR
 * codes. The code belongs on the ticket page, where the screen is given over to
 * it — offering one here would put two ways to reach the same code on the site
 * and make the door instruction ambiguous.
 *
 * The empty state is a real slot rather than a hidden section, because "you
 * have no tickets" is information: it is the answer to the question the page
 * was opened to ask, and a section that vanishes when empty leaves the reader
 * unsure whether it loaded.
 */

/** How many fit before this stops being a preview. */
const PREVIEW = 3;

export function MyTicketsSection() {
  const { data, loading } = useApi<IssuedTicket[]>("/api/me/tickets");

  /*
    Live and cancelled tickets only, soonest first. A cancelled showing still
    belongs here — it is the one someone most needs to be told about — but a
    ticket from last spring is history, and history is what `/me/tickets` is
    for.
  */
  const now = Date.now();
  const upcoming = (data ?? [])
    .filter((t) => (t.startAt ? new Date(t.startAt).getTime() >= now : true))
    .sort((a, b) => {
      const ta = a.startAt ? new Date(a.startAt).getTime() : Infinity;
      const tb = b.startAt ? new Date(b.startAt).getTime() : Infinity;
      return ta - tb;
    });

  const shown = upcoming.slice(0, PREVIEW);

  return (
    <section aria-labelledby="me-tickets-heading">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2
          id="me-tickets-heading"
          className="flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          <TicketIcon className="size-4 text-foreground" aria-hidden />
          بلیت‌های من
          {data && upcoming.length > 0 ? (
            <span className="text-muted">({formatNumber(upcoming.length)})</span>
          ) : null}
        </h2>
        <Link
          href="/me/tickets"
          className="rounded-md text-xs text-accent-text underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          همهٔ بلیت‌ها
        </Link>
      </div>

      {/*
        Three placeholders shaped like three cards, not one line of text. The
        section is 3 × 84px tall once it loads; anything shorter here moves
        everything below it the moment the tickets land.
      */}
      {!data && loading ? (
        <SkeletonGroup>
          {Array.from({ length: PREVIEW }, (_, i) => (
            <div
              key={i}
              className="flex h-[84px] flex-col justify-center gap-2 rounded-xl border border-border bg-card px-4"
            >
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          ))}
        </SkeletonGroup>
      ) : shown.length === 0 ? (
        <EmptySlot />
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((t) => (
            <TicketRow key={t.id} ticket={t} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** The slot a ticket will occupy, with nothing in it yet. */
function EmptySlot() {
  return (
    <div className="flex min-h-[172px] flex-col items-center justify-center rounded-xl border border-dashed border-field-border bg-card p-8 text-center">
      {/*
        `--field-border` and not `--border`: a dashed outline *is* the whole
        object here, and --border is a divider tint that does not carry a shape
        on its own.
      */}
      <span className="mb-3 grid size-11 place-items-center rounded-full bg-subtle text-faint">
        <TicketIcon className="size-5" aria-hidden />
      </span>
      <p className="text-sm font-medium text-foreground">هنوز بلیتی ندارید</p>
      <p className="mx-auto mt-1 max-w-xs text-sm leading-relaxed text-muted">
        بلیت‌هایی که می‌خرید اینجا می‌آیند و کد ورودشان همیشه در دسترس است.
      </p>
      <Link
        href="/events"
        className="mt-4 rounded-md text-sm font-medium text-accent-text underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      >
        کاوش رویدادها
      </Link>
    </div>
  );
}

function TicketRow({ ticket: t }: { ticket: IssuedTicket }) {
  const off = Boolean(t.showCancelled);
  const soon = !off && t.startAt ? relativeDay(t.startAt) : undefined;

  return (
    <li>
      <Link
        href="/me/tickets"
        className={cn(
          "flex h-[84px] items-center gap-3 rounded-xl border border-border bg-card px-4 outline-none transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring",
          off && "opacity-80",
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-sm font-bold text-foreground">
            {t.eventTitle}
          </span>
          <span className="flex items-center gap-3 text-xs text-muted">
            {t.startAt ? (
              <span className="flex shrink-0 items-center gap-1.5">
                <CalendarDays className="size-3.5 text-faint" aria-hidden />
                {formatJalaliDate(t.startAt)} · {formatTime(t.startAt)}
              </span>
            ) : null}
            {t.seat ? (
              <span className="flex shrink-0 items-center gap-1.5">
                <Armchair className="size-3.5 text-faint" aria-hidden />
                {formatSeat(t.seat)}
              </span>
            ) : null}
          </span>
        </span>

        {/* One chip, never two: «لغو شده» answers the same question «فردا»
            does, and answers it more urgently. */}
        {off ? (
          <span className="shrink-0 rounded-md bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger-text">
            لغو شده
          </span>
        ) : soon ? (
          <span className="shrink-0 rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-text">
            {soon}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
