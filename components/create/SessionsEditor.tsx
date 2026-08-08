"use client";

import { useState } from "react";
import { Check, Plus, Trash2, X, CalendarRange, ListChecks } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatNumber, formatJalaliDate } from "@/lib/format";
import { Field } from "@/components/ui/field";
import { DateField } from "@/components/ui/date-field";
import { TimeField } from "@/components/ui/time-field";
import { DurationField } from "@/components/ui/duration-field";
import { Toggle } from "@/components/create/ui";
import { DateRangeFields } from "@/components/create/DateRangeFields";
import { CALENDAR_MODE_ENABLED } from "@/lib/flags";
import { WEEKDAY_LABELS, WEEKDAY_ORDER } from "@/lib/wizard/labels";
import { DEFAULT_DURATION_MIN, slotLabel } from "@/lib/create/types";
import type { ScheduleDraft, TimeSlot } from "@/lib/create/types";
import type { WeekDay } from "@/types";

interface Props {
  schedule: ScheduleDraft;
  generatedCount: number;
  error?: string;
  /** Hide the «زمان‌بندی تقویمی» toggle (dashboard edits are always calendar). */
  hideToggle?: boolean;
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

/** A سانس row: optional date (non-calendar) + start time and length. */
function SlotRow({
  slot,
  index,
  withDate,
  canRemove,
  onChange,
  onRemove,
}: {
  slot: TimeSlot;
  index: number;
  withDate: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<TimeSlot>) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={cn(
        "grid gap-3 rounded-lg border border-border p-4 sm:items-end",
        withDate
          ? "sm:grid-cols-[auto_1.2fr_1fr_1fr_auto]"
          : "sm:grid-cols-[auto_1fr_1fr_auto]",
      )}
    >
      <span className="text-sm font-medium text-muted sm:pb-3">
        سانس {formatNumber(index + 1)}
      </span>
      {withDate ? (
        <Field id={`slot-date-${slot.id}`} label="تاریخ">
          <DateField
            id={`slot-date-${slot.id}`}
            value={slot.date}
            onChange={(v) => onChange({ date: v })}
          />
        </Field>
      ) : null}
      <Field id={`slot-start-${slot.id}`} label="شروع">
        <TimeField
          id={`slot-start-${slot.id}`}
          value={slot.startTime}
          onChange={(v) => onChange({ startTime: v })}
        />
      </Field>
      <Field id={`slot-duration-${slot.id}`} label="مدت (دقیقه)">
        <DurationField
          id={`slot-duration-${slot.id}`}
          value={slot.durationMin}
          onChange={(v) => onChange({ durationMin: v })}
        />
      </Field>
      {canRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="حذف سانس"
          className="mb-1 grid size-9 place-items-center rounded-md text-muted outline-none transition-colors hover:bg-subtle hover:text-danger-text focus-visible:ring-2 focus-visible:ring-ring"
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
    hideToggle = false,
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
  const isRange = Boolean(schedule.range);
  const rangeSlot = schedule.slots[0];

  /** Switch the non-calendar scenario between specific سانس‌ها and multi-day. */
  const selectScenario = (range: boolean) => {
    if (range === isRange) return;
    // Collapse to a single shared slot when entering the range scenario.
    onScheduleChange(
      range
        ? { range: true, slots: [{ ...schedule.slots[0], date: "" }] }
        : { range: false },
    );
  };
  // Per-day سانس‌ها that are open for editing. A row stays open (start +
  // duration fields) until confirmed, so setting the start time doesn't collapse
  // it into a chip before the user can adjust the length.
  const [editingDaySlots, setEditingDaySlots] = useState<Set<string>>(
    () => new Set(),
  );
  const openDaySlot = (id: string) =>
    setEditingDaySlots((prev) => new Set(prev).add(id));
  const closeDaySlot = (id: string) =>
    setEditingDaySlots((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  const activeDays = WEEKDAY_ORDER.filter((d) => schedule.byDay.includes(d));

  const slotsSection = (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium text-foreground">
        {schedule.calendar ? "سانس‌های پیش‌فرض" : "سانس‌ها"}
      </span>
      {schedule.slots.map((s, i) => (
        <SlotRow
          key={s.id}
          slot={s}
          index={i}
          withDate={!schedule.calendar}
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
  );

  // Scenario picker (non-calendar): specific dated سانس‌ها vs a multi-day range.
  const scenarioPicker = (
    <div className="grid gap-2 sm:grid-cols-2">
      {(
        [
          {
            range: false,
            Icon: ListChecks,
            title: "سانس‌های مشخص",
            hint: "یک یا چند سانس با تاریخ و ساعت جداگانه",
          },
          {
            range: true,
            Icon: CalendarRange,
            title: "رویداد چند روزه",
            hint: "یک بازهٔ تاریخ با ساعت ثابت هر روز",
          },
        ] as const
      ).map(({ range, Icon, title, hint }) => (
        <button
          key={String(range)}
          type="button"
          aria-pressed={isRange === range}
          onClick={() => selectScenario(range)}
          className={cn(
            "flex items-start gap-2.5 rounded-md border p-3 text-start outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            isRange === range
              ? "border-foreground bg-subtle"
              : "border-border hover:border-border-strong",
          )}
        >
          <Icon className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">{title}</span>
            <span className="text-xs text-muted">{hint}</span>
          </span>
        </button>
      ))}
    </div>
  );

  // Multi-day range: an inline calendar (range) + shared hour range.
  const rangeSection = (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium text-foreground">بازهٔ برگزاری</span>
      <DateRangeFields
        value={{
          startDate: schedule.startDate,
          endDate: schedule.endDate,
          startTime: rangeSlot?.startTime ?? "",
          durationMin: rangeSlot?.durationMin ?? DEFAULT_DURATION_MIN,
        }}
        invalid={Boolean(error)}
        onChange={({ startDate, endDate, startTime, durationMin }) =>
          onScheduleChange({
            startDate,
            endDate,
            slots: [
              { id: rangeSlot?.id ?? "slot-1", date: "", startTime, durationMin },
            ],
          })
        }
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {!hideToggle && CALENDAR_MODE_ENABLED ? (
        <Toggle
          label="زمان‌بندی تقویمی"
          hint="برای رویدادهای تقویمی روی روزهای مشخص هفته فعال کنید."
          checked={schedule.calendar}
          onChange={(v) => onScheduleChange({ calendar: v })}
        />
      ) : null}

      {!schedule.calendar ? (
        // Non-calendar: pick specific dated سانس‌ها or a multi-day range.
        <>
          {scenarioPicker}
          {isRange ? rangeSection : slotsSection}
        </>
      ) : (
        <>
          {/* Date range (calendar only) */}
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

          {/* Performance days */}
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
                    "rounded-full border px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
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

          {slotsSection}

          {/* Per-weekday سانس‌ها (chips) */}
          {activeDays.length > 0 ? (
            <div className="flex flex-col gap-3">
              <span className="text-sm font-medium text-foreground">سانس هر روز</span>
              <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
                {activeDays.map((day) => {
                  const extra = schedule.daySlots[day] ?? [];
                  // A row is open while it's being edited or has no start time
                  // yet; entered-and-confirmed سانس‌ها collapse into chips.
                  const openRows = extra.filter(
                    (s) => editingDaySlots.has(s.id) || !s.startTime,
                  );
                  const chips = extra.filter(
                    (s) => s.startTime && !editingDaySlots.has(s.id),
                  );
                  return (
                    <div key={day} className="flex flex-col gap-2.5 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {WEEKDAY_LABELS[day]}
                        </span>
                        {/* default سانس‌ها as read-only chips */}
                        {schedule.slots
                          .filter((s) => s.startTime)
                          .map((s) => (
                            <span
                              key={s.id}
                              className="rounded-full border border-border bg-subtle px-3 py-1 text-xs text-muted"
                            >
                              {slotLabel(s)}
                            </span>
                          ))}
                        {/* per-day extra سانس‌ها as editable/removable chips */}
                        {chips.map((s) => (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-1.5 rounded-full border border-foreground bg-foreground px-3 py-1 text-xs text-background"
                          >
                            <button
                              type="button"
                              onClick={() => openDaySlot(s.id)}
                              /*
                                `outline-none` with nothing put back: tabbing to
                                this سانس chip showed no focus at all, the one
                                case CLAUDE.md's "visible focus ring on every
                                interactive element" is meant to prevent.

                                Not the house `ring-ring` either. That is
                                tuned for light surfaces, and this button sits on
                                a `bg-foreground` chip where the pink at 40%
                                measures **1.53:1** — a focus ring nobody can
                                see, which is the same bug with more code. The
                                chip's own ink is 18.3:1 against it.
                              */
                              className="rounded-sm outline-none hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-background"
                            >
                              {slotLabel(s)}
                            </button>
                            <button
                              type="button"
                              onClick={() => onRemoveDaySlot(day, s.id)}
                              aria-label="حذف سانس"
                              className="text-background/70 hover:text-background"
                            >
                              <X className="size-3" aria-hidden />
                            </button>
                          </span>
                        ))}
                        <button
                          type="button"
                          onClick={() => onAddDaySlot(day)}
                          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted hover:border-border-strong hover:text-foreground"
                        >
                          <Plus className="size-3.5" aria-hidden />
                          افزودن سانس
                        </button>
                      </div>
                      {/* time entry for open day سانس‌ها; stays open until confirmed */}
                      {openRows.map((s) => (
                        <div
                          key={s.id}
                          className="grid gap-3 rounded-md bg-subtle p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                        >
                          <Field id={`d-start-${day}-${s.id}`} label="شروع">
                            <TimeField
                              id={`d-start-${day}-${s.id}`}
                              value={s.startTime}
                              onChange={(v) => {
                                onDaySlotChange(day, s.id, { startTime: v });
                                // Keep the row open so the duration can still be
                                // adjusted instead of collapsing into a chip.
                                openDaySlot(s.id);
                              }}
                            />
                          </Field>
                          <Field id={`d-duration-${day}-${s.id}`} label="مدت (دقیقه)">
                            <DurationField
                              id={`d-duration-${day}-${s.id}`}
                              value={s.durationMin}
                              onChange={(v) =>
                                onDaySlotChange(day, s.id, { durationMin: v })
                              }
                            />
                          </Field>
                          <div className="mb-1 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => closeDaySlot(s.id)}
                              disabled={!s.startTime}
                              aria-label="تأیید سانس"
                              className="grid size-9 place-items-center rounded-md text-muted outline-none transition-colors hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                            >
                              <Check className="size-4" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                closeDaySlot(s.id);
                                onRemoveDaySlot(day, s.id);
                              }}
                              aria-label="حذف سانس"
                              className="grid size-9 place-items-center rounded-md text-muted outline-none transition-colors hover:bg-background hover:text-danger-text focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Exceptions */}
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
                      className="text-muted hover:text-danger-text"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </>
      )}

      {generatedCount > 0 ? (
        <p className="text-xs text-muted">
          {formatNumber(generatedCount)} جلسه ساخته می‌شود.
        </p>
      ) : null}

      {error ? <p className="text-sm text-danger-text">{error}</p> : null}
    </div>
  );
}
