"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatNumber, formatJalaliDate } from "@/lib/format";
import { Field } from "@/components/ui/field";
import { DateField } from "@/components/ui/date-field";
import { TimeField } from "@/components/ui/time-field";
import { Toggle } from "@/components/create/ui";
import { WEEKDAY_LABELS, WEEKDAY_ORDER } from "@/lib/wizard/labels";
import type { ScheduleDraft, TimeSlot } from "@/lib/create/types";
import type { WeekDay } from "@/types";

interface Props {
  schedule: ScheduleDraft;
  generatedCount: number;
  error?: string;
  onScheduleChange: (patch: Partial<ScheduleDraft>) => void;
  onSlotChange: (id: string, patch: Partial<TimeSlot>) => void;
  onAddSlot: () => void;
  onRemoveSlot: (id: string) => void;
  onToggleDay: (day: WeekDay) => void;
  onAddDaySlot: (day: WeekDay) => void;
  onRemoveDaySlot: (day: WeekDay, id: string) => void;
  onDaySlotChange: (day: WeekDay, id: string, patch: Partial<TimeSlot>) => void;
  onAddException: (date: string) => void;
  onRemoveException: (date: string) => void;
}

/** A pair of start/end time fields with an optional remove button. */
function SlotRow({
  slot,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  slot: TimeSlot;
  index: number;
  canRemove: boolean;
  onChange: (patch: Partial<TimeSlot>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-end">
      <span className="text-sm font-medium text-muted sm:pb-3">
        سانس {formatNumber(index + 1)}
      </span>
      <Field id={`slot-start-${slot.id}`} label="شروع">
        <TimeField
          id={`slot-start-${slot.id}`}
          value={slot.startTime}
          onChange={(v) => onChange({ startTime: v })}
        />
      </Field>
      <Field id={`slot-end-${slot.id}`} label="پایان">
        <TimeField
          id={`slot-end-${slot.id}`}
          value={slot.endTime}
          onChange={(v) => onChange({ endTime: v })}
        />
      </Field>
      {canRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="حذف سانس"
          className="mb-1 grid size-9 place-items-center rounded-md text-muted outline-none transition-colors hover:bg-subtle hover:text-danger focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      ) : (
        <span className="hidden sm:block sm:size-9" />
      )}
    </div>
  );
}

export function SessionsEditor(props: Props) {
  const {
    schedule,
    generatedCount,
    error,
    onScheduleChange,
    onSlotChange,
    onAddSlot,
    onRemoveSlot,
    onToggleDay,
    onAddDaySlot,
    onRemoveDaySlot,
    onDaySlotChange,
    onAddException,
    onRemoveException,
  } = props;

  const [exceptionDate, setExceptionDate] = useState("");
  const activeDays = WEEKDAY_ORDER.filter((d) => schedule.byDay.includes(d));
  const globalSlotLabel = schedule.slots
    .filter((s) => s.startTime)
    .map((s) => (s.endTime ? `${s.startTime}–${s.endTime}` : s.startTime))
    .join(" · ");

  return (
    <div className="flex flex-col gap-5">
      <Toggle
        label="زمان‌بندی تقویمی"
        hint="برای رویدادهای تکرارشونده روی روزهای مشخص هفته فعال کنید."
        checked={schedule.calendar}
        onChange={(v) => onScheduleChange({ calendar: v })}
      />

      {/* Date range (both models) */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="start-date" label="تاریخ شروع">
          <DateField
            id="start-date"
            value={schedule.startDate}
            onChange={(v) => onScheduleChange({ startDate: v })}
            invalid={Boolean(error)}
          />
        </Field>
        <Field id="end-date" label="تاریخ پایان">
          <DateField
            id="end-date"
            value={schedule.endDate}
            onChange={(v) => onScheduleChange({ endDate: v })}
          />
        </Field>
      </div>

      {/* Performance days (calendar model only) */}
      {schedule.calendar ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">روزهای اجرا</span>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_ORDER.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={schedule.byDay.includes(d)}
                onClick={() => onToggleDay(d)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/15",
                  schedule.byDay.includes(d)
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted hover:border-border-strong",
                )}
              >
                {WEEKDAY_LABELS[d]}
              </button>
            ))}
          </div>
          <p className="text-xs text-faint">
            اگر روزی انتخاب نشود، همهٔ روزهای بازه در نظر گرفته می‌شود.
          </p>
        </div>
      ) : null}

      {/* سانس‌ها — default time slots (both models) */}
      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium text-foreground">
          {schedule.calendar ? "سانس‌های پیش‌فرض" : "سانس‌ها"}
        </span>
        {schedule.slots.map((s, i) => (
          <SlotRow
            key={s.id}
            slot={s}
            index={i}
            canRemove={schedule.slots.length > 1}
            onChange={(p) => onSlotChange(s.id, p)}
            onRemove={() => onRemoveSlot(s.id)}
          />
        ))}
        <button
          type="button"
          onClick={onAddSlot}
          className="inline-flex w-fit items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-sm font-medium text-muted hover:border-border-strong hover:text-foreground"
        >
          <Plus className="size-4" aria-hidden />
          افزودن سانس
        </button>
      </div>

      {/* Per-weekday سانس‌ها (calendar model) */}
      {schedule.calendar && activeDays.length > 0 ? (
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium text-foreground">سانس هر روز</span>
          <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
            {activeDays.map((day) => {
              const extra = schedule.daySlots[day] ?? [];
              return (
                <div key={day} className="flex flex-col gap-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-foreground">
                      {WEEKDAY_LABELS[day]}
                    </span>
                    <span className="text-xs text-muted">
                      {globalSlotLabel || "بدون سانس پیش‌فرض"}
                    </span>
                  </div>
                  {extra.map((s) => (
                    <div key={s.id} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                      <Field id={`d-start-${day}-${s.id}`} label="شروع">
                        <TimeField
                          id={`d-start-${day}-${s.id}`}
                          value={s.startTime}
                          onChange={(v) => onDaySlotChange(day, s.id, { startTime: v })}
                        />
                      </Field>
                      <Field id={`d-end-${day}-${s.id}`} label="پایان">
                        <TimeField
                          id={`d-end-${day}-${s.id}`}
                          value={s.endTime}
                          onChange={(v) => onDaySlotChange(day, s.id, { endTime: v })}
                        />
                      </Field>
                      <button
                        type="button"
                        onClick={() => onRemoveDaySlot(day, s.id)}
                        aria-label="حذف سانس"
                        className="mb-1 grid size-9 place-items-center rounded-md text-muted outline-none transition-colors hover:bg-subtle hover:text-danger focus-visible:ring-2 focus-visible:ring-ring/40"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => onAddDaySlot(day)}
                    className="inline-flex w-fit items-center gap-1 text-xs font-medium text-muted hover:text-foreground"
                  >
                    <Plus className="size-3.5" aria-hidden />
                    افزودن سانس برای {WEEKDAY_LABELS[day]}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Exceptions — dates to skip (e.g. holidays) */}
      {schedule.calendar ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">
            استثناها (روزهای بدون سانس)
          </span>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <DateField value={exceptionDate} onChange={setExceptionDate} />
            </div>
            <button
              type="button"
              onClick={() => {
                onAddException(exceptionDate);
                setExceptionDate("");
              }}
              disabled={!exceptionDate}
              className="inline-flex h-12 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-subtle disabled:opacity-50"
            >
              <Plus className="size-4" aria-hidden />
              افزودن
            </button>
          </div>
          {schedule.exceptions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {schedule.exceptions.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-subtle px-3 py-1 text-xs text-foreground"
                >
                  {formatJalaliDate(`${d}T00:00:00.000Z`)}
                  <button
                    type="button"
                    onClick={() => onRemoveException(d)}
                    aria-label="حذف استثنا"
                    className="text-muted hover:text-danger"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {generatedCount > 0 ? (
        <p className="text-xs text-muted">
          {formatNumber(generatedCount)} جلسه ساخته می‌شود.
        </p>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
