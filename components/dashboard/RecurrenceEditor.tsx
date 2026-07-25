"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Repeat, Pencil, Check, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DateField } from "@/components/ui/date-field";
import { formatNumber, formatJalaliDate } from "@/lib/format";
import {
  FREQUENCY_LABELS,
  FREQUENCY_ORDER,
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
} from "@/lib/wizard/labels";
import type { RecurrenceFrequency, RecurrenceRule, WeekDay } from "@/types";

interface Props {
  eventId: string;
  recurrence?: RecurrenceRule;
}

type EndMode = "count" | "until" | "none";

/** Human summary of the repeat interval, e.g. «هر ۲ هفته». */
function intervalText(frequency: RecurrenceFrequency, interval: number): string {
  const unit: Record<RecurrenceFrequency, string> = {
    daily: "روز",
    weekly: "هفته",
    monthly: "ماه",
    weekday: "روز کاری",
  };
  return interval > 1
    ? `هر ${formatNumber(interval)} ${unit[frequency]}`
    : `هر ${unit[frequency]}`;
}

/**
 * Overview-tab card that shows and edits the full recurrence rule of a
 * تقویمی (recurring) event: frequency, interval, performance weekdays
 * (روزهای اجرا), and the series bound (تعداد جلسات / تا تاریخ / بی‌پایان).
 * Mirrors the options exposed in the event-creation composer.
 */
export function RecurrenceEditor({ eventId, recurrence }: Props) {
  const router = useRouter();
  const rule: RecurrenceRule = recurrence ?? { frequency: "weekly", interval: 1 };

  const [editing, setEditing] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(rule.frequency);
  const [interval, setInterval] = useState(String(rule.interval));
  const [byDay, setByDay] = useState<WeekDay[]>(rule.byDay ?? []);
  const [endMode, setEndMode] = useState<EndMode>(
    rule.count != null ? "count" : rule.until != null ? "until" : "none",
  );
  const [count, setCount] = useState(rule.count != null ? String(rule.count) : "");
  const [until, setUntil] = useState(rule.until ? rule.until.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setFrequency(rule.frequency);
    setInterval(String(rule.interval));
    setByDay(rule.byDay ?? []);
    setEndMode(rule.count != null ? "count" : rule.until != null ? "until" : "none");
    setCount(rule.count != null ? String(rule.count) : "");
    setUntil(rule.until ? rule.until.slice(0, 10) : "");
    setError("");
    setEditing(false);
  }

  function toggleDay(day: WeekDay) {
    setByDay((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  async function save() {
    const n = Math.max(1, Math.floor(Number(interval) || 1));
    if (endMode === "count" && !(Number(count) > 0)) {
      setError("تعداد جلسات را وارد کنید.");
      return;
    }
    if (endMode === "until" && !until) {
      setError("تاریخ پایان سری را انتخاب کنید.");
      return;
    }
    const next: RecurrenceRule = {
      frequency,
      interval: n,
      ...(frequency === "weekly" && byDay.length > 0 ? { byDay } : {}),
      ...(endMode === "count"
        ? { count: Math.max(1, Math.floor(Number(count))) }
        : {}),
      ...(endMode === "until" ? { until: `${until}T00:00:00.000Z` } : {}),
    };

    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recurrence: next }),
      });
      if (!res.ok) throw new Error("خطا در ذخیرهٔ الگوی تکرار.");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای ناشناخته رخ داد.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    const activeDays = WEEKDAY_ORDER.filter((d) => (rule.byDay ?? []).includes(d));
    return (
      <section className="rounded-lg border border-border p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Repeat className="size-4 text-faint" aria-hidden />
            الگوی تکرار (تقویمی)
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
            <dt className="text-muted">تناوب</dt>
            <dd className="text-foreground">{FREQUENCY_LABELS[rule.frequency]}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">بازهٔ تکرار</dt>
            <dd className="text-foreground">
              {intervalText(rule.frequency, rule.interval)}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="shrink-0 text-muted">روزهای اجرا</dt>
            <dd className="text-foreground">
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
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">پایان سری</dt>
            <dd className="text-foreground">
              {rule.count != null
                ? `${formatNumber(rule.count)} جلسه`
                : rule.until != null
                  ? `تا ${formatJalaliDate(rule.until)}`
                  : "بدون پایان"}
            </dd>
          </div>
        </dl>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Repeat className="size-4 text-faint" aria-hidden />
        الگوی تکرار (تقویمی)
      </h2>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="rec-frequency" label="تناوب">
            <Select
              id="rec-frequency"
              value={frequency}
              onChange={(e) =>
                setFrequency(e.target.value as RecurrenceFrequency)
              }
            >
              {FREQUENCY_ORDER.map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABELS[f]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="rec-interval" label="هر چند بار یک‌بار">
            <Input
              id="rec-interval"
              type="number"
              min={1}
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
            />
          </Field>
        </div>

        {frequency === "weekly" ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">روزهای اجرا</span>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_ORDER.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={byDay.includes(d)}
                  onClick={() => toggleDay(d)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/15",
                    byDay.includes(d)
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted hover:border-border-strong",
                  )}
                >
                  {WEEKDAY_LABELS[d]}
                </button>
              ))}
            </div>
            <p className="text-xs text-faint">
              اگر روزی انتخاب نشود، همهٔ روزهای هفته در نظر گرفته می‌شود.
            </p>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="rec-end" label="پایان سری">
            <Select
              id="rec-end"
              value={endMode}
              onChange={(e) => setEndMode(e.target.value as EndMode)}
            >
              <option value="count">بر اساس تعداد جلسات</option>
              <option value="until">تا تاریخ مشخص</option>
              <option value="none">بدون پایان</option>
            </Select>
          </Field>
          {endMode === "count" ? (
            <Field id="rec-count" label="تعداد جلسات">
              <Input
                id="rec-count"
                type="number"
                min={1}
                value={count}
                onChange={(e) => setCount(e.target.value)}
              />
            </Field>
          ) : endMode === "until" ? (
            <Field id="rec-until" label="تا تاریخ">
              <DateField id="rec-until" value={until} onChange={setUntil} />
            </Field>
          ) : null}
        </div>

        {error ? <p className="text-xs text-danger">{error}</p> : null}
        <div className="flex items-center gap-2">
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
      </div>
    </section>
  );
}
