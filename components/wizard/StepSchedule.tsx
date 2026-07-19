import { cn } from "@/lib/utils";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type {
  OneTimeForm,
  RecurringForm,
  WizardMode,
} from "@/lib/wizard/types";
import type { Errors } from "@/lib/wizard/validation";
import {
  FREQUENCY_LABELS,
  FREQUENCY_ORDER,
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
} from "@/lib/wizard/labels";
import type { WeekDay } from "@/types";

interface StepScheduleProps {
  mode: WizardMode;
  oneTime: OneTimeForm;
  recurring: RecurringForm;
  errors: Errors;
  onModeChange: (mode: WizardMode) => void;
  onOneTimeChange: (patch: Partial<OneTimeForm>) => void;
  onRecurringChange: (patch: Partial<RecurringForm>) => void;
  onToggleDay: (day: WeekDay) => void;
}

const MODES: { value: WizardMode; title: string; description: string }[] = [
  { value: "one-time", title: "تک‌جلسه‌ای", description: "یک تاریخ و ساعت مشخص" },
  {
    value: "recurring",
    title: "تکرارشونده",
    description: "جلسات تکرارشونده بر اساس قاعده",
  },
];

/** Step 2: schedule and availability (one-time or recurring). */
export function StepSchedule({
  mode,
  oneTime,
  recurring,
  errors,
  onModeChange,
  onOneTimeChange,
  onRecurringChange,
  onToggleDay,
}: StepScheduleProps) {
  return (
    <div className="flex flex-col gap-6">
      <div
        role="radiogroup"
        aria-label="نوع زمان‌بندی"
        className="grid gap-3 sm:grid-cols-2"
      >
        {MODES.map((m) => {
          const selected = mode === m.value;
          return (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onModeChange(m.value)}
              className={cn(
                "rounded-lg border p-4 text-start outline-none transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring/15",
                selected
                  ? "border-foreground bg-subtle"
                  : "border-border hover:border-border-strong",
              )}
            >
              <span className="block text-sm font-semibold text-foreground">
                {m.title}
              </span>
              <span className="mt-1 block text-xs text-muted">
                {m.description}
              </span>
            </button>
          );
        })}
      </div>

      {mode === "one-time" ? (
        <div className="grid gap-6 sm:grid-cols-3">
          <Field id="date" label="تاریخ" required error={errors.date}>
            <Input
              id="date"
              type="date"
              value={oneTime.date}
              onChange={(e) => onOneTimeChange({ date: e.target.value })}
              aria-invalid={Boolean(errors.date)}
            />
          </Field>
          <Field
            id="startTime"
            label="زمان شروع"
            required
            error={errors.startTime}
          >
            <Input
              id="startTime"
              type="time"
              value={oneTime.startTime}
              onChange={(e) => onOneTimeChange({ startTime: e.target.value })}
              aria-invalid={Boolean(errors.startTime)}
            />
          </Field>
          <Field id="endTime" label="زمان پایان" required error={errors.endTime}>
            <Input
              id="endTime"
              type="time"
              value={oneTime.endTime}
              onChange={(e) => onOneTimeChange({ endTime: e.target.value })}
              aria-invalid={Boolean(errors.endTime)}
            />
          </Field>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <Field id="frequency" label="تناوب">
              <Select
                id="frequency"
                value={recurring.frequency}
                onChange={(e) =>
                  onRecurringChange({
                    frequency: e.target.value as RecurringForm["frequency"],
                  })
                }
              >
                {FREQUENCY_ORDER.map((f) => (
                  <option key={f} value={f}>
                    {FREQUENCY_LABELS[f]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              id="interval"
              label="هر چند بار یک‌بار"
              hint="مثلاً هر ۲ هفته یک‌بار"
              error={errors.recInterval}
            >
              <Input
                id="interval"
                type="number"
                min={1}
                inputMode="numeric"
                value={recurring.interval}
                onChange={(e) =>
                  onRecurringChange({ interval: e.target.value })
                }
                aria-invalid={Boolean(errors.recInterval)}
              />
            </Field>
          </div>

          {recurring.frequency === "weekly" ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">
                روزهای هفته
              </span>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_ORDER.map((day) => {
                  const active = recurring.byDay.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onToggleDay(day)}
                      className={cn(
                        "rounded-md border px-3 py-2 text-sm outline-none transition-colors",
                        "focus-visible:ring-2 focus-visible:ring-ring/15",
                        active
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-muted hover:border-border-strong",
                      )}
                    >
                      {WEEKDAY_LABELS[day]}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="grid gap-6 sm:grid-cols-3">
            <Field
              id="recDate"
              label="تاریخ اولین جلسه"
              required
              error={errors.recDate}
            >
              <Input
                id="recDate"
                type="date"
                value={recurring.date}
                onChange={(e) => onRecurringChange({ date: e.target.value })}
                aria-invalid={Boolean(errors.recDate)}
              />
            </Field>
            <Field
              id="recStartTime"
              label="زمان شروع"
              required
              error={errors.recStartTime}
            >
              <Input
                id="recStartTime"
                type="time"
                value={recurring.startTime}
                onChange={(e) =>
                  onRecurringChange({ startTime: e.target.value })
                }
                aria-invalid={Boolean(errors.recStartTime)}
              />
            </Field>
            <Field
              id="recEndTime"
              label="زمان پایان"
              required
              error={errors.recEndTime}
            >
              <Input
                id="recEndTime"
                type="time"
                value={recurring.endTime}
                onChange={(e) =>
                  onRecurringChange({ endTime: e.target.value })
                }
                aria-invalid={Boolean(errors.recEndTime)}
              />
            </Field>
          </div>

          <Field
            id="recUntil"
            label="پایان سری (اختیاری)"
            hint="اگر خالی بماند، سری بدون تاریخ پایان در نظر گرفته می‌شود."
            error={errors.recUntil}
            className="sm:max-w-xs"
          >
            <Input
              id="recUntil"
              type="date"
              value={recurring.until}
              onChange={(e) => onRecurringChange({ until: e.target.value })}
              aria-invalid={Boolean(errors.recUntil)}
            />
          </Field>
        </div>
      )}
    </div>
  );
}
