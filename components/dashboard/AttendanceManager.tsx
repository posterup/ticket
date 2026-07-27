"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Ticket, TrendingUp, Users } from "lucide-react";

import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { formatNumber } from "@/lib/format";
import { CheckinPanel } from "@/components/checkin/CheckinPanel";
import { GuestInvite, type GuestItem } from "@/components/dashboard/GuestInvite";
import type { Holder, SessionRef } from "@/lib/checkin/data";

/**
 * Session-first پذیرش و مهمانان tab. The host picks a سانس before anything is
 * shown; the rest of the tab (sales insight, check-in, guests) is scoped to
 * that session. A session with no sold tickets and no guests shows an empty
 * state instead of the insight/lists.
 */
export function AttendanceManager({
  eventId,
  eventTitle,
  sessions,
  holders,
  capacity,
  guests: initialGuests,
  initialChecked = [],
  allowGuests = true,
  onlyGuests = false,
}: {
  eventId: string;
  eventTitle: string;
  sessions: SessionRef[];
  /** Issued ("sold") tickets across the event's sessions. */
  holders: Holder[];
  /** Per-session capacity, used as the sales progress denominator. */
  capacity: number;
  guests: GuestItem[];
  initialChecked?: string[];
  /** Recurring events don't take guest invites (kept from the tab's rules). */
  allowGuests?: boolean;
  /**
   * Free events have no ticket sales or check-in, so the tab collapses to just
   * the مهمان‌ها box (still scoped by the سانس picker).
   */
  onlyGuests?: boolean;
}) {
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? "");
  const [guests, setGuests] = useState<GuestItem[]>(initialGuests);

  const sessionHolders = useMemo(
    () => holders.filter((h) => h.sessionId === sessionId),
    [holders, sessionId],
  );
  const sessionGuests = useMemo(
    () => (allowGuests ? guests.filter((g) => g.sessionId === sessionId) : []),
    [allowGuests, guests, sessionId],
  );

  const sold = sessionHolders.length;
  const isEmpty = sold === 0 && sessionGuests.length === 0;

  // Sales breakdown by ticket type for the selected سانس.
  const byType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const h of sessionHolders) {
      counts.set(h.ticketType, (counts.get(h.ticketType) ?? 0) + 1);
    }
    return [...counts.entries()].map(([name, count]) => ({ name, count }));
  }, [sessionHolders]);

  const cap = capacity > 0 ? capacity : sold;
  const pct = cap > 0 ? Math.min(100, Math.round((sold / cap) * 100)) : 0;

  const going = sessionGuests.filter((g) => g.status === "going").length;
  const pending = sessionGuests.filter((g) => g.status === "pending").length;
  const declined = sessionGuests.filter((g) => g.status === "declined").length;

  async function invite(
    contact: string,
    channel: "phone" | "username",
  ): Promise<string | null> {
    try {
      const res = await fetch(`/api/events/${eventId}/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, contact, channel }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error();
      setGuests((prev) => [
        { id: json.data.id, sessionId, contact, channel, status: "pending" },
        ...prev,
      ]);
      return null;
    } catch {
      return "خطا در ثبت مهمان.";
    }
  }

  function setStatus(id: string, status: GuestItem["status"]) {
    setGuests((prev) => prev.map((g) => (g.id === id ? { ...g, status } : g)));
    void fetch(`/api/events/${eventId}/guests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  function remove(id: string) {
    setGuests((prev) => prev.filter((g) => g.id !== id));
    void fetch(`/api/events/${eventId}/guests/${id}`, { method: "DELETE" });
  }

  const checkinEvents = [
    { id: eventId, title: eventTitle, sessions, holders },
  ];

  // مهمان‌ها — sits under the sales-insight card and stays available in the
  // empty state so the first guest can still be invited.
  const guestsSection = allowGuests ? (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Users className="size-4 text-faint" aria-hidden />
          مهمان‌ها
        </h2>
        {sessionGuests.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-full border border-border bg-subtle px-2 py-0.5 text-muted">
              همه {formatNumber(sessionGuests.length)}
            </span>
            <span className="rounded-full border border-border bg-subtle px-2 py-0.5 text-success">
              می‌آیند {formatNumber(going)}
            </span>
            <span className="rounded-full border border-border bg-subtle px-2 py-0.5 text-muted">
              در انتظار {formatNumber(pending)}
            </span>
            <span className="rounded-full border border-border bg-subtle px-2 py-0.5 text-danger">
              نمی‌آیند {formatNumber(declined)}
            </span>
          </div>
        ) : null}
      </div>
      <GuestInvite
        guests={sessionGuests}
        onInvite={invite}
        onSetStatus={setStatus}
        onRemove={remove}
      />
    </section>
  ) : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Session-first: choose the سانس before any data is shown. */}
      <Field
        id="attendance-session"
        label="سانس"
        hint="ابتدا سانس موردنظر را انتخاب کنید؛ اطلاعات همین سانس نمایش داده می‌شود."
      >
        <Select
          id="attendance-session"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
        >
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>

      {onlyGuests ? (
        // Free event: no sales insight or check-in — only مهمان‌ها.
        guestsSection
      ) : isEmpty ? (
        <>
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-subtle/40 p-10 text-center">
            <CalendarClock className="size-8 text-faint" aria-hidden />
            <p className="text-sm font-medium text-foreground">
              هنوز داده‌ای برای این سانس نیست
            </p>
            <p className="max-w-sm text-xs text-muted">
              {allowGuests
                ? "برای این سانس هنوز بلیتی فروخته نشده و مهمانی ثبت نشده است. می‌توانید از بخش «دعوت مهمان» مهمان اضافه کنید."
                : "برای این سانس هنوز بلیتی فروخته نشده است."}
            </p>
          </div>
          {guestsSection}
        </>
      ) : (
        <>
          {/* Sales insight — sold tickets + progress at a glance. */}
          <section className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-faint" aria-hidden />
              <h2 className="text-sm font-semibold text-foreground">
                فروش بلیت این سانس
              </h2>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <p>
                <span className="text-2xl font-bold text-foreground">
                  {formatNumber(sold)}
                </span>
                <span className="text-sm text-muted">
                  {" "}
                  از {formatNumber(cap)} ظرفیت
                </span>
              </p>
              <span className="text-sm font-semibold text-foreground">
                {formatNumber(pct)}٪
              </span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-subtle">
              <span
                className="block h-full rounded-full bg-foreground transition-[width]"
                style={{ width: `${pct}%` }}
              />
            </div>
            {byType.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                {byType.map((t) => (
                  <span
                    key={t.name}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-subtle px-3 py-1 text-xs text-muted"
                  >
                    <Ticket className="size-3.5" aria-hidden />
                    {t.name}
                    <span className="font-semibold text-foreground">
                      {formatNumber(t.count)}
                    </span>
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          {/* مهمان‌ها — directly under the sales-insight card. */}
          {guestsSection}

          {/* Check-in tool, scoped to the selected سانس. */}
          <CheckinPanel
            events={checkinEvents}
            initialChecked={initialChecked}
            sessionId={sessionId}
            onSessionChange={setSessionId}
            hideControls
          />
        </>
      )}
    </div>
  );
}
