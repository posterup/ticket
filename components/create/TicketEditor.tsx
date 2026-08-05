"use client";

import { Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Textarea } from "@/components/ui/textarea";
import { DateField } from "@/components/ui/date-field";
import { Disclosure, Toggle } from "@/components/create/ui";
import type { TicketTypeDraft } from "@/lib/create/types";

export interface SessionOption {
  id: string;
  label: string;
}

/**
 * Editor for one paid ticket type (name + price + options). Free events are
 * handled by the «بلیت رایگان» switch in the composer, so this editor is only
 * ever rendered for priced tickets.
 */
export function TicketEditor({
  ticket: t,
  sessions,
  error,
  canRemove,
  onChange,
  onRemove,
}: {
  ticket: TicketTypeDraft;
  sessions: SessionOption[];
  error?: string;
  canRemove: boolean;
  onChange: (patch: Partial<TicketTypeDraft>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-4 sm:p-5">
      {/* Name + price */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`name-${t.id}`} label="نام بلیت" required>
          <Input
            id={`name-${t.id}`}
            value={t.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="مثلاً عادی، ویژه…"
          />
        </Field>
        <Field id={`price-${t.id}`} label="قیمت (تومان)" required>
          <MoneyInput
            id={`price-${t.id}`}
            value={t.price}
            onChange={(v) => onChange({ price: v })}
          />
        </Field>
      </div>

      {/* Capacity + description */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`cap-${t.id}`} label="ظرفیت">
          <Input
            id={`cap-${t.id}`}
            type="number"
            min={0}
            inputMode="numeric"
            value={t.capacity}
            onChange={(e) => onChange({ capacity: e.target.value })}
            placeholder="نامحدود"
          />
        </Field>
        <Field id={`desc-${t.id}`} label="توضیحات">
          <Textarea
            id={`desc-${t.id}`}
            rows={2}
            value={t.description}
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </Field>
      </div>

      {/* Advanced */}
      <Disclosure label="گزینه‌های پیشرفته">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`minord-${t.id}`} label="حداقل در هر خرید">
            <Input
              id={`minord-${t.id}`}
              type="number"
              min={1}
              inputMode="numeric"
              value={t.minPerOrder}
              onChange={(e) => onChange({ minPerOrder: e.target.value })}
            />
          </Field>
          <Field id={`maxord-${t.id}`} label="حداکثر در هر خرید">
            <Input
              id={`maxord-${t.id}`}
              type="number"
              min={1}
              inputMode="numeric"
              value={t.maxPerOrder}
              onChange={(e) => onChange({ maxPerOrder: e.target.value })}
            />
          </Field>
        </div>

        {/* Sales window — gated by a toggle */}
        <div className="flex flex-col gap-3">
          <Toggle
            label="زمان‌بندی فروش"
            hint="بازهٔ زمانی فروش این بلیت را مشخص کنید؛ در غیر این صورت فروش باز است."
            checked={t.salesSchedule}
            onChange={(v) => onChange({ salesSchedule: v })}
          />
          {t.salesSchedule ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`ss-${t.id}`} label="شروع فروش">
                <DateField
                  id={`ss-${t.id}`}
                  value={t.salesStart}
                  onChange={(v) => onChange({ salesStart: v })}
                />
              </Field>
              <Field id={`se-${t.id}`} label="پایان فروش">
                <DateField
                  id={`se-${t.id}`}
                  value={t.salesEnd}
                  onChange={(v) => onChange({ salesEnd: v })}
                />
              </Field>
            </div>
          ) : null}
        </div>

        {/* Early bird — a lower price before a cutoff date */}
        <div className="flex flex-col gap-3">
          <Toggle
            label="فروش زودهنگام"
            hint="خریدهای پیش از تاریخ تعیین‌شده با قیمت کمتری ثبت می‌شوند."
            checked={t.earlyBird}
            onChange={(v) => onChange({ earlyBird: v })}
          />
          {t.earlyBird ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`eb-price-${t.id}`} label="قیمت زودهنگام (تومان)">
                <MoneyInput
                  id={`eb-price-${t.id}`}
                  value={t.earlyBirdPrice}
                  onChange={(v) => onChange({ earlyBirdPrice: v })}
                />
              </Field>
              <Field id={`eb-until-${t.id}`} label="تا تاریخ">
                <DateField
                  id={`eb-until-${t.id}`}
                  value={t.earlyBirdUntil}
                  onChange={(v) => onChange({ earlyBirdUntil: v })}
                />
              </Field>
            </div>
          ) : null}
        </div>

        {/* Per-session attachment */}
        {sessions.length > 1 ? (
          <div className="flex flex-col gap-3">
            <Toggle
              label="برای همهٔ سانس‌ها"
              hint="اگر خاموش شود، بلیت فقط برای سانس‌های انتخابی فروخته می‌شود."
              checked={t.appliesToAll}
              onChange={(v) => onChange({ appliesToAll: v })}
            />
            {!t.appliesToAll ? (
              <div className="flex flex-wrap gap-2">
                {sessions.map((s) => {
                  const on = t.sessionIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        onChange({
                          sessionIds: on
                            ? t.sessionIds.filter((id) => id !== s.id)
                            : [...t.sessionIds, s.id],
                        })
                      }
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                        on
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-muted hover:border-border-strong",
                      )}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </Disclosure>

      {error ? <p className="text-sm text-danger-text">{error}</p> : null}

      {canRemove ? (
        <div className="flex justify-end border-t border-border pt-3">
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-danger-text"
          >
            <Trash2 className="size-4" aria-hidden />
            حذف این بلیت
          </button>
        </div>
      ) : null}
    </div>
  );
}
