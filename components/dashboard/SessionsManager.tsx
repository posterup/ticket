"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Repeat, Pencil, Ban, RotateCcw, Check, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { DateField } from "@/components/ui/date-field";
import { TimeField } from "@/components/ui/time-field";
import { formatJalaliDate, formatTime } from "@/lib/format";
import type { EventSession } from "@/types";

/** Split a stored ISO datetime into date (`YYYY-MM-DD`) + time (`HH:mm`). */
function splitIso(iso: string): { date: string; time: string } {
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/** Recombine a date + `HH:mm` into the stored ISO form used across the app. */
function toIso(date: string, time: string): string {
  return `${date}T${time || "00:00"}:00.000Z`;
}

interface Props {
  eventId: string;
  sessions: EventSession[];
  modeLabel: string;
  recurrence: string | null;
}

/** Schedule list with per-سانس reschedule and cancel/restore controls. */
export function SessionsManager({
  eventId,
  sessions,
  modeLabel,
  recurrence,
}: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function patch(sessionId: string, body: Record<string, unknown>) {
    setBusyId(sessionId);
    setError("");
    try {
      const res = await fetch(
        `/api/events/${eventId}/sessions/${sessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error("خطا در به‌روزرسانی سانس.");
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای ناشناخته رخ داد.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-lg border border-border p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Clock className="size-4 text-faint" aria-hidden />
        زمان‌بندی · {modeLabel}
      </h2>

      {error ? <p className="mb-3 text-xs text-danger">{error}</p> : null}

      <ul className="flex flex-col divide-y divide-border">
        {sessions.map((s) => (
          <li key={s.id} className="py-3 first:pt-0 last:pb-0">
            {editingId === s.id ? (
              <SessionEditor
                session={s}
                busy={busyId === s.id}
                onSave={(startAt, endAt) => patch(s.id, { startAt, endAt })}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-sm",
                      s.cancelled
                        ? "text-faint line-through"
                        : "text-foreground",
                    )}
                  >
                    {formatJalaliDate(s.startAt)} · {formatTime(s.startAt)} تا{" "}
                    {formatTime(s.endAt)}
                  </p>
                  {s.cancelled ? (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger/5 px-2 py-0.5 text-xs text-danger">
                      <Ban className="size-3" aria-hidden />
                      لغوشده
                    </span>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {s.cancelled ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busyId === s.id}
                      onClick={() => patch(s.id, { cancelled: false })}
                    >
                      <RotateCcw aria-hidden />
                      بازگردانی
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busyId === s.id}
                        onClick={() => {
                          setError("");
                          setEditingId(s.id);
                        }}
                      >
                        <Pencil aria-hidden />
                        ویرایش
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-danger hover:bg-danger/5"
                        disabled={busyId === s.id}
                        onClick={() => patch(s.id, { cancelled: true })}
                      >
                        <Ban aria-hidden />
                        لغو سانس
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {recurrence ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted">
          <Repeat className="size-3.5 text-faint" aria-hidden />
          {recurrence}
        </p>
      ) : null}
    </section>
  );
}

/** Inline date + start/end time editor for a single سانس. */
function SessionEditor({
  session,
  busy,
  onSave,
  onCancel,
}: {
  session: EventSession;
  busy: boolean;
  onSave: (startAt: string, endAt: string) => void;
  onCancel: () => void;
}) {
  const start = splitIso(session.startAt);
  const end = splitIso(session.endAt);
  const [date, setDate] = useState(start.date);
  const [startTime, setStartTime] = useState(start.time);
  const [endTime, setEndTime] = useState(end.time);
  const [localError, setLocalError] = useState("");

  function submit() {
    if (!date || !startTime || !endTime) {
      setLocalError("تاریخ و ساعت شروع و پایان را کامل کنید.");
      return;
    }
    if (endTime < startTime) {
      setLocalError("ساعت پایان نباید پیش از ساعت شروع باشد.");
      return;
    }
    onSave(toIso(date, startTime), toIso(date, endTime));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id={`date-${session.id}`} label="تاریخ">
          <DateField id={`date-${session.id}`} value={date} onChange={setDate} />
        </Field>
        <Field id={`start-${session.id}`} label="شروع">
          <TimeField
            id={`start-${session.id}`}
            value={startTime}
            onChange={setStartTime}
          />
        </Field>
        <Field id={`end-${session.id}`} label="پایان">
          <TimeField
            id={`end-${session.id}`}
            value={endTime}
            onChange={setEndTime}
          />
        </Field>
      </div>
      {localError ? <p className="text-xs text-danger">{localError}</p> : null}
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={submit} disabled={busy}>
          <Check aria-hidden />
          {busy ? "در حال ذخیره…" : "ذخیره"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={busy}
        >
          <X aria-hidden />
          انصراف
        </Button>
      </div>
    </div>
  );
}
