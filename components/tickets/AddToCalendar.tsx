"use client";

/**
 * Put the showing in the holder's calendar.
 *
 * The ticket page showed a QR code and nothing else, which quietly assumed the
 * buyer would remember to come back to it. Most of a ticket's value is
 * delivered by the reminder their phone gives them the evening before, and that
 * was left entirely to them.
 *
 * Built as a download rather than a link to Google Calendar: an `.ics` works on
 * every phone, needs no account, and does not tell a third party what its
 * holder is going to. The seat is written into the entry, so the reminder that
 * arrives says where to sit.
 */

import { formatSeat } from "@/lib/format";
import { useCallback, useState } from "react";
import { CalendarPlus } from "lucide-react";

import { icsFileName, toIcs } from "@/lib/tickets/calendar";
import { Button } from "@/components/ui/button";
import type { IssuedTicket } from "@/types";

export function AddToCalendar({ ticket }: { ticket: IssuedTicket }) {
  const [failed, setFailed] = useState(false);

  const download = useCallback(() => {
    if (!ticket.startAt) return;
    try {
      const seat = ticket.seat
        ? formatSeat(ticket.seat)
        : ticket.ticketTypeName;

      const ics = toIcs({
        // Stable per ticket: re-adding replaces the entry rather than making a
        // duplicate, which is what happens if the UID changes each time.
        uid: `${ticket.id}@poster`,
        title: ticket.eventTitle,
        startAt: ticket.startAt,
        endAt: ticket.endAt,
        location: ticket.venueName,
        description: `${seat}\nکد پیگیری: ${ticket.orderCode}`,
      });

      const url = URL.createObjectURL(
        new Blob([ics], { type: "text/calendar;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = icsFileName(ticket.eventTitle);
      link.click();
      // Revoked on the next tick: Safari has not finished reading the blob
      // when `click()` returns.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setFailed(true);
    }
  }, [ticket]);

  // Nothing to add without a date, and a cancelled show is not something the
  // holder should be reminded to attend.
  if (!ticket.startAt || ticket.showCancelled) return null;

  return (
    <div className="flex flex-col items-center gap-1">
      <Button size="sm" variant="secondary" onClick={download}>
        <CalendarPlus aria-hidden />
        افزودن به تقویم
      </Button>
      {failed ? (
        <p role="status" className="text-[11px] text-danger-text">
          ساخت فایل تقویم ممکن نشد.
        </p>
      ) : null}
    </div>
  );
}
