"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Ban, RotateCcw, Check, X, Plus } from "lucide-react";

import { apiFetch } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EditButton } from "@/components/dashboard/EditButton";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { DateField } from "@/components/ui/date-field";
import { TimeField } from "@/components/ui/time-field";
import { DurationField } from "@/components/ui/duration-field";
import {
  formatJalaliDate,
  formatNumber,
  formatTime,
  venueIso,
  venueParts,
} from "@/lib/format";
import {
  SESSION_AVAILABILITY_LABELS,
  SESSION_AVAILABILITY_ORDER,
} from "@/lib/events/labels";
import { DEFAULT_DURATION_MIN } from "@/lib/create/types";
import type { EventSession, SessionAvailability } from "@/types";

/**
 * A stored سانس's length, for the duration field.
 *
 * Measured between the two instants rather than between their clock faces: a
 * سانس that runs 23:00→01:00 is two hours, and subtracting «01:00» from
 * «23:00» says minus twenty-two.
 */
function sessionMinutes(s: EventSession): string {
  const ms = Date.parse(s.endAt) - Date.parse(s.startAt);
  return ms > 0 ? String(Math.round(ms / 60_000)) : DEFAULT_DURATION_MIN;
}

/** Recombine a date + `HH:mm` into the stored ISO form used across the app. */
/**
 * Venue wall clock, not UTC. See `venueIso` — appending `Z` here meant the
 * editor showed a time three and a half hours off the row beside it.
 */
const toIso = venueIso;

interface Props {
  eventId: string;
  sessions: EventSession[];
  modeLabel: string | null;
  /**
   * Hide the per-سانس «وضعیت» (sales/capacity state). Free events have no sales,
   * so the status chips and editor field are dropped.
   */
  hideStatus?: boolean;
}

/** Schedule list with per-سانس reschedule and cancel/restore controls. */
export function SessionsManager({
  eventId,
  sessions,
  modeLabel,
  hideStatus = false,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  /**
   * Cancelling now texts every ticket holder, so it stopped being a one-click
   * action. The organiser is told the size of what they are about to do first —
   * you cannot un-send two hundred messages.
   */
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [reach, setReach] = useState<{
    people: number;
    tickets: number;
    smsConfigured: boolean;
  } | null>(
    null,
  );

  const askCancel = useCallback(
    async (sessionId: string) => {
      setConfirmCancel(sessionId);
      setReach(null);
      try {
        const res = await apiFetch<{
          reach: { people: number; tickets: number; smsConfigured: boolean };
        }>(`/api/events/${eventId}/refunds?sessionId=${sessionId}`);
        setReach(res.reach);
      } catch {
        // The count is advisory. Failing to load it must not block a
        // cancellation an organiser has already decided on. `smsConfigured` is
        // unread at zero reach — the copy branches on `people > 0` first — so
        // this value never reaches a sentence.
        setReach({ people: 0, tickets: 0, smsConfigured: true });
      }
    },
    [eventId],
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
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

  async function addNew(
    startAt: string,
    endAt: string,
    availability: SessionAvailability,
  ) {
    setBusyId("new");
    setError("");
    try {
      const res = await fetch(`/api/events/${eventId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startAt, endAt, availability }),
      });
      if (!res.ok) throw new Error("خطا در افزودن سانس.");
      setAdding(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای ناشناخته رخ داد.");
    } finally {
      setBusyId(null);
    }
  }

  // Read-only summary until the organiser taps «ویرایش» (top-left, like every
  // other overview card). Editing reveals the per-سانس controls.
  if (!editing) {
    return (
      <section className="rounded-lg border border-border p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock className="size-4 text-faint" aria-hidden />
            زمان‌بندی{modeLabel ? ` · ${modeLabel}` : ""}
          </h2>
          <EditButton
            onClick={() => {
              setError("");
              setEditing(true);
            }}
          />
        </div>
        <ul className="flex flex-col divide-y divide-border">
          {sessions.map((s) => (
            <li key={s.id} className="py-3 first:pt-0 last:pb-0">
              <p
                className={cn(
                  "text-sm",
                  s.cancelled ? "text-faint line-through" : "text-foreground",
                )}
              >
                {formatJalaliDate(s.startAt)} · {formatTime(s.startAt)} تا{" "}
                {formatTime(s.endAt)}
              </p>
              {s.cancelled || !hideStatus ? (
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {s.cancelled ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger/5 px-2 py-0.5 text-xs text-danger-text">
                      <Ban className="size-3" aria-hidden />
                      لغوشده
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-border bg-subtle px-2 py-0.5 text-xs text-muted">
                      {SESSION_AVAILABILITY_LABELS[s.availability ?? "available"]}
                    </span>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Clock className="size-4 text-faint" aria-hidden />
          زمان‌بندی{modeLabel ? ` · ${modeLabel}` : ""}
        </h2>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setEditing(false);
            setEditingId(null);
            setAdding(false);
            setError("");
          }}
        >
          <Check aria-hidden />
          پایان
        </Button>
      </div>

      {error ? <p className="mb-3 text-xs text-danger-text">{error}</p> : null}

      <ul className="flex flex-col divide-y divide-border">
        {sessions.map((s) => (
          <li key={s.id} className="py-3 first:pt-0 last:pb-0">
            {editingId === s.id ? (
              <SessionEditor
                idKey={s.id}
                initial={{
                  date: venueParts(s.startAt).date,
                  startTime: venueParts(s.startAt).time,
                  durationMin: sessionMinutes(s),
                  availability: s.availability ?? "available",
                }}
                busy={busyId === s.id}
                hideStatus={hideStatus}
                onSave={(startAt, endAt, availability) =>
                  patch(s.id, { startAt, endAt, availability })
                }
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
                  {s.cancelled || !hideStatus ? (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {s.cancelled ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger/5 px-2 py-0.5 text-xs text-danger-text">
                          <Ban className="size-3" aria-hidden />
                          لغوشده
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-border bg-subtle px-2 py-0.5 text-xs text-muted">
                          {SESSION_AVAILABILITY_LABELS[s.availability ?? "available"]}
                        </span>
                      )}
                    </div>
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
                      <EditButton
                        disabled={busyId === s.id}
                        onClick={() => {
                          setError("");
                          setEditingId(s.id);
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-danger-text hover:bg-danger/5"
                        disabled={busyId === s.id}
                        onClick={() => void askCancel(s.id)}
                      >
                        <Ban aria-hidden />
                        لغو سانس
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}

            {confirmCancel === s.id ? (
              <div className="mt-3 flex flex-col gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3">
                <p className="text-xs leading-relaxed text-foreground">
                  {reach === null
                    ? "در حال بررسی تعداد خریداران…"
                    : reach.people > 0
                      ? reach.smsConfigured
                        ? `به ${formatNumber(reach.people)} خریدار (${formatNumber(reach.tickets)} بلیت) پیامک لغو می‌رود و باید مبلغ آن‌ها بازپرداخت شود.`
                        /*
                          The same number, and the opposite meaning.
                          
                          Every notifier opens with `if (!configured) return
                          QUIET`, so with no operator credentials this cancels
                          the showing and tells nobody. The organiser walks away
                          believing their buyers were informed; the buyers turn
                          up at a door that is not opening.
                        */
                        : `سرویس پیامک پیکربندی نشده است: ${formatNumber(reach.people)} خریدار (${formatNumber(reach.tickets)} بلیت) خبردار نمی‌شوند و باید خودتان به آن‌ها اطلاع دهید و مبلغشان را بازپرداخت کنید.`
                      : "خریداری برای این سانس ثبت نشده است."}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    /*
                      `hover:brightness-90`, not `hover:bg-danger/90`. The `/90`
                      is an *opacity* modifier, so it did the opposite of what a
                      hover on a filled button is meant to do: it let the page
                      through and made the button lighter, dropping white-on-red
                      from 4.73:1 to 4.28:1. Pointing at «لغو سانس» made its
                      label harder to read. Brightness darkens the fill itself —
                      5.63:1 — so the affordance and the contrast agree.
                    */
                    className="bg-danger text-white hover:brightness-90"
                    disabled={busyId === s.id || reach === null}
                    onClick={() => {
                      setConfirmCancel(null);
                      patch(s.id, { cancelled: true });
                    }}
                  >
                    لغو سانس
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmCancel(null)}
                  >
                    انصراف
                  </Button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="mt-3 border-t border-border pt-3">
        {adding ? (
          <SessionEditor
            idKey="new"
            initial={{
              date: "",
              startTime: "",
              durationMin: DEFAULT_DURATION_MIN,
              availability: "available",
            }}
            busy={busyId === "new"}
            hideStatus={hideStatus}
            onSave={addNew}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setError("");
              setAdding(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-sm font-medium text-muted hover:border-border-strong hover:text-foreground"
          >
            <Plus className="size-4" aria-hidden />
            افزودن سانس
          </button>
        )}
      </div>
    </section>
  );
}

/** Inline date + start/end time editor for a سانس (existing or new). */
function SessionEditor({
  idKey,
  initial,
  busy,
  hideStatus = false,
  onSave,
  onCancel,
}: {
  idKey: string;
  initial: {
    date: string;
    startTime: string;
    durationMin: string;
    availability: SessionAvailability;
  };
  busy: boolean;
  hideStatus?: boolean;
  onSave: (
    startAt: string,
    endAt: string,
    availability: SessionAvailability,
  ) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(initial.date);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [durationMin, setDurationMin] = useState(initial.durationMin);
  const [availability, setAvailability] = useState<SessionAvailability>(
    initial.availability,
  );
  const [localError, setLocalError] = useState("");

  function submit() {
    const minutes = Number(durationMin);
    if (!date || !startTime) {
      setLocalError("تاریخ و ساعت شروع را کامل کنید.");
      return;
    }
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setLocalError("مدت برگزاری را به دقیقه وارد کنید.");
      return;
    }
    // The end is the start *instant* plus the minutes, so a سانس running past
    // midnight lands on the next day. Pairing the derived clock back with
    // `date` would put it before its own start — the shape the old
    // «ساعت پایان نباید پیش از ساعت شروع باشد» check existed to refuse.
    const startAt = toIso(date, startTime);
    const endAt = new Date(Date.parse(startAt) + minutes * 60_000).toISOString();
    onSave(startAt, endAt, availability);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id={`date-${idKey}`} label="تاریخ">
          <DateField id={`date-${idKey}`} value={date} onChange={setDate} />
        </Field>
        <Field id={`start-${idKey}`} label="شروع">
          <TimeField
            id={`start-${idKey}`}
            value={startTime}
            onChange={setStartTime}
          />
        </Field>
        <Field id={`duration-${idKey}`} label="مدت (دقیقه)">
          <DurationField
            id={`duration-${idKey}`}
            value={durationMin}
            onChange={setDurationMin}
          />
        </Field>
        {hideStatus ? null : (
          <Field id={`availability-${idKey}`} label="وضعیت">
            <Select
              id={`availability-${idKey}`}
              value={availability}
              onChange={(e) =>
                setAvailability(e.target.value as SessionAvailability)
              }
            >
              {SESSION_AVAILABILITY_ORDER.map((a) => (
                <option key={a} value={a}>
                  {SESSION_AVAILABILITY_LABELS[a]}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      {localError ? <p className="text-xs text-danger-text">{localError}</p> : null}
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
