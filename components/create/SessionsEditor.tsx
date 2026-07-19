"use client";

import { Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { Field } from "@/components/ui/field";
import { DateField } from "@/components/ui/date-field";
import { TimeField } from "@/components/ui/time-field";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  FREQUENCY_LABELS,
  FREQUENCY_ORDER,
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
} from "@/lib/wizard/labels";
import { SCHEDULE_LABELS } from "@/lib/create/labels";
import type {
  RecurrenceDraft,
  ScheduleMode,
  SessionDraft,
} from "@/lib/create/types";
import type { RecurrenceFrequency, WeekDay } from "@/types";

const MODES: ScheduleMode[] = ["single", "recurring", "multi"];

export function SessionsEditor({
  scheduleMode,
  sessions,
  recurrence,
  generatedCount,
  error,
  onModeChange,
  onSessionChange,
  onAddSession,
  onRemoveSession,
  onRecurrenceChange,
  onToggleDay,
}: {
  scheduleMode: ScheduleMode;
  sessions: SessionDraft[];
  recurrence: RecurrenceDraft;
  generatedCount: number;
  error?: string;
  onModeChange: (mode: ScheduleMode) => void;
  onSessionChange: (id: string, patch: Partial<SessionDraft>) => void;
  onAddSession: () => void;
  onRemoveSession: (id: string) => void;
  onRecurrenceChange: (patch: Partial<RecurrenceDraft>) => void;
  onToggleDay: (day: WeekDay) => void;
}) {
  // Both "multi" and "recurring" support several سانس; "recurring" then
  // repeats that whole set across occurrences.
  const showList = scheduleMode !== "single";
  const rows = scheduleMode === "single" ? sessions.slice(0, 1) : sessions;
  const baseCount = rows.filter((s) => s.date).length;
  const occurrences = Math.max(Number.parseInt(recurrence.count, 10) || 1, 1);

  return (
    <div className="flex flex-col gap-5">
      {/* Mode */}
      <div className="grid grid-cols-3 gap-2">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={scheduleMode === m}
            onClick={() => onModeChange(m)}
            className={cn(
              "rounded-md border px-3 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/15",
              scheduleMode === m
                ? "border-foreground bg-subtle text-foreground"
                : "border-border text-muted hover:border-border-strong",
            )}
          >
            {SCHEDULE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Session rows */}
      <div className="flex flex-col gap-3">
        {rows.map((s, i) => (
          <div
            key={s.id}
            className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
          >
            <Field id={`date-${s.id}`} label={showList ? `سانس ${formatNumber(i + 1)} — تاریخ` : "تاریخ"}>
              <DateField
                id={`date-${s.id}`}
                value={s.date}
                onChange={(v) => onSessionChange(s.id, { date: v })}
              />
            </Field>
            <Field id={`start-${s.id}`} label="شروع">
              <TimeField
                id={`start-${s.id}`}
                value={s.startTime}
                onChange={(v) => onSessionChange(s.id, { startTime: v })}
              />
            </Field>
            <Field id={`end-${s.id}`} label="پایان">
              <TimeField
                id={`end-${s.id}`}
                value={s.endTime}
                onChange={(v) => onSessionChange(s.id, { endTime: v })}
              />
            </Field>
            {showList && sessions.length > 1 ? (
              <button
                type="button"
                onClick={() => onRemoveSession(s.id)}
                aria-label="حذف سانس"
                className="mb-1 grid size-9 place-items-center rounded-md text-muted outline-none transition-colors hover:bg-subtle hover:text-danger focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            ) : (
              <span className="hidden sm:block sm:size-9" />
            )}
          </div>
        ))}
      </div>

      {showList ? (
        <button
          type="button"
          onClick={onAddSession}
          className="inline-flex w-fit items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-sm font-medium text-muted hover:border-border-strong hover:text-foreground"
        >
          <Plus className="size-4" aria-hidden />
          افزودن سانس
        </button>
      ) : null}

      {/* Recurrence controls */}
      {scheduleMode === "recurring" ? (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-subtle p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field id="freq" label="تکرار">
              <Select
                id="freq"
                value={recurrence.frequency}
                onChange={(e) =>
                  onRecurrenceChange({
                    frequency: e.target.value as RecurrenceFrequency,
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
            <Field id="interval" label="فاصله">
              <Input
                id="interval"
                type="number"
                min={1}
                value={recurrence.interval}
                onChange={(e) => onRecurrenceChange({ interval: e.target.value })}
              />
            </Field>
            <Field id="count" label="تعداد نوبت">
              <Input
                id="count"
                type="number"
                min={1}
                max={60}
                value={recurrence.count}
                onChange={(e) => onRecurrenceChange({ count: e.target.value })}
              />
            </Field>
          </div>
          {recurrence.frequency === "weekly" ? (
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_ORDER.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={recurrence.byDay.includes(d)}
                  onClick={() => onToggleDay(d)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/15",
                    recurrence.byDay.includes(d)
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted hover:border-border-strong",
                  )}
                >
                  {WEEKDAY_LABELS[d]}
                </button>
              ))}
            </div>
          ) : null}
          <p className="text-xs text-muted">
            {baseCount > 1
              ? `${formatNumber(occurrences)} نوبت × ${formatNumber(baseCount)} سانس = ${formatNumber(generatedCount)} جلسه ساخته می‌شود.`
              : `${formatNumber(generatedCount)} جلسه ساخته می‌شود.`}
          </p>
          {baseCount > 1 ? (
            <p className="text-xs text-faint">
              همهٔ سانس‌های بالا در هر نوبت تکرار می‌شوند.
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
