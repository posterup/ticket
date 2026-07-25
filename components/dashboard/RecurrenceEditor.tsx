"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Pencil, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatJalaliDate } from "@/lib/format";
import { WEEKDAY_LABELS, WEEKDAY_ORDER } from "@/lib/wizard/labels";
import { SessionsEditor } from "@/components/create/SessionsEditor";
import {
  emptySlot,
  expandSchedule,
  type ScheduleDraft,
  type TimeSlot,
} from "@/lib/create/types";
import type { RecurrenceSchedule, WeekDay } from "@/types";

interface Props {
  eventId: string;
  /** Initial calendar schedule (derived on the server from the event). */
  schedule: ScheduleDraft;
}

/** `YYYY-MM-DD` → Jalali label, tolerating an empty string. */
function jalali(date: string): string {
  return date ? formatJalaliDate(`${date}T00:00:00.000Z`) : "—";
}

/**
 * Overview-tab card that shows and edits the calendar schedule of a تقویمی
 * (recurring) event. The edit UI reuses the exact {@link SessionsEditor} from
 * the event-creation composer (date range, روزهای اجرا, سانس‌ها, استثناها).
 */
export function RecurrenceEditor({ eventId, schedule: initial }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const generatedCount = useMemo(
    () => expandSchedule(schedule).length,
    [schedule],
  );

  function reset() {
    setSchedule(initial);
    setError("");
    setEditing(false);
  }

  // --- schedule handlers (mirror the composer) ---
  const scheduleChange = (p: Partial<ScheduleDraft>) =>
    setSchedule((s) => ({ ...s, ...p, calendar: true }));
  const addSlot = () =>
    setSchedule((s) => ({ ...s, slots: [...s.slots, emptySlot(crypto.randomUUID())] }));
  const removeSlot = (id: string) =>
    setSchedule((s) => ({
      ...s,
      slots: s.slots.length > 1 ? s.slots.filter((x) => x.id !== id) : s.slots,
    }));
  const slotChange = (id: string, p: Partial<TimeSlot>) =>
    setSchedule((s) => ({
      ...s,
      slots: s.slots.map((x) => (x.id === id ? { ...x, ...p } : x)),
    }));
  const toggleDay = (day: WeekDay) =>
    setSchedule((s) => ({
      ...s,
      byDay: s.byDay.includes(day)
        ? s.byDay.filter((x) => x !== day)
        : [...s.byDay, day],
    }));
  const patchDaySlots = (day: WeekDay, fn: (slots: TimeSlot[]) => TimeSlot[]) =>
    setSchedule((s) => ({
      ...s,
      daySlots: { ...s.daySlots, [day]: fn(s.daySlots[day] ?? []) },
    }));
  const addDaySlot = (day: WeekDay) =>
    patchDaySlots(day, (s) => [...s, emptySlot(crypto.randomUUID())]);
  const removeDaySlot = (day: WeekDay, id: string) =>
    patchDaySlots(day, (s) => s.filter((x) => x.id !== id));
  const daySlotChange = (day: WeekDay, id: string, p: Partial<TimeSlot>) =>
    patchDaySlots(day, (s) => s.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const addException = (date: string) =>
    setSchedule((s) =>
      !date || s.exceptions.includes(date)
        ? s
        : { ...s, exceptions: [...s.exceptions, date].sort() },
    );
  const removeException = (date: string) =>
    setSchedule((s) => ({
      ...s,
      exceptions: s.exceptions.filter((x) => x !== date),
    }));

  async function save() {
    if (!schedule.startDate) {
      setError("تاریخ شروع را انتخاب کنید.");
      return;
    }
    const slots = schedule.slots.filter((s) => s.startTime);
    if (slots.length === 0) {
      setError("دست‌کم یک سانس با ساعت شروع تعریف کنید.");
      return;
    }
    const cleanSlot = (s: TimeSlot) => ({
      id: s.id,
      startTime: s.startTime,
      endTime: s.endTime || s.startTime,
    });
    const daySlots: NonNullable<RecurrenceSchedule["daySlots"]> = {};
    for (const d of WEEKDAY_ORDER) {
      const arr = (schedule.daySlots[d] ?? [])
        .filter((s) => s.startTime)
        .map(cleanSlot);
      if (arr.length > 0) daySlots[d] = arr;
    }
    const spec: RecurrenceSchedule = {
      startDate: schedule.startDate,
      endDate: schedule.endDate || schedule.startDate,
      byDay: schedule.byDay,
      slots: slots.map(cleanSlot),
      ...(Object.keys(daySlots).length > 0 ? { daySlots } : {}),
      exceptions: schedule.exceptions,
    };

    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recurrenceSchedule: spec }),
      });
      if (!res.ok) throw new Error("خطا در ذخیرهٔ زمان‌بندی.");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای ناشناخته رخ داد.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    const activeDays = WEEKDAY_ORDER.filter((d) => schedule.byDay.includes(d));
    const times = schedule.slots.filter((s) => s.startTime);
    return (
      <section className="rounded-lg border border-border p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CalendarRange className="size-4 text-faint" aria-hidden />
            زمان‌بندی تقویمی
          </h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setEditing(true)}
          >
            <Pencil aria-hidden />
            ویرایش
          </Button>
        </div>

        <dl className="flex flex-col gap-2.5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">بازهٔ برگزاری</dt>
            <dd className="text-foreground">
              {jalali(schedule.startDate)} تا {jalali(schedule.endDate)}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="shrink-0 text-muted">روزهای اجرا</dt>
            <dd>
              {activeDays.length > 0 ? (
                <span className="flex flex-wrap justify-end gap-1.5">
                  {activeDays.map((d) => (
                    <span
                      key={d}
                      className="rounded-full border border-border bg-subtle px-2 py-0.5 text-xs text-muted"
                    >
                      {WEEKDAY_LABELS[d]}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-faint">همهٔ روزها</span>
              )}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="shrink-0 text-muted">سانس‌ها</dt>
            <dd>
              {times.length > 0 ? (
                <span className="flex flex-wrap justify-end gap-1.5" dir="ltr">
                  {times.map((s) => (
                    <span
                      key={s.id}
                      className="rounded-full border border-border bg-subtle px-2 py-0.5 text-xs text-muted"
                    >
                      {s.endTime ? `${s.startTime}–${s.endTime}` : s.startTime}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-faint">—</span>
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">استثناها</dt>
            <dd className="text-foreground">
              {schedule.exceptions.length > 0
                ? schedule.exceptions.map((d) => jalali(d)).join("، ")
                : "ندارد"}
            </dd>
          </div>
        </dl>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
        <CalendarRange className="size-4 text-faint" aria-hidden />
        زمان‌بندی تقویمی
      </h2>
      <SessionsEditor
        schedule={schedule}
        generatedCount={generatedCount}
        error={error}
        hideToggle
        onScheduleChange={scheduleChange}
        onSlotChange={slotChange}
        onAddSlot={addSlot}
        onRemoveSlot={removeSlot}
        onToggleDay={toggleDay}
        onAddDaySlot={addDaySlot}
        onRemoveDaySlot={removeDaySlot}
        onDaySlotChange={daySlotChange}
        onAddException={addException}
        onRemoveException={removeException}
      />
      <div className="mt-5 flex items-center gap-2">
        <Button type="button" size="sm" onClick={save} disabled={saving}>
          <Check aria-hidden />
          {saving ? "در حال ذخیره…" : "ذخیره"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={reset}
          disabled={saving}
        >
          <X aria-hidden />
          انصراف
        </Button>
      </div>
    </section>
  );
}
