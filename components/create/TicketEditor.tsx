"use client";

import { Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DateField } from "@/components/ui/date-field";
import { Disclosure, Toggle } from "@/components/create/ui";
import { TICKET_KIND_LABELS, TICKET_KIND_HINTS } from "@/lib/create/labels";
import type { TicketKind, TicketTypeDraft } from "@/lib/create/types";

const KINDS: TicketKind[] = ["paid", "free", "addon"];

export interface SessionOption {
  id: string;
  label: string;
}

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
  const priced = t.kind === "paid" || t.kind === "addon";

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-4 sm:p-5">
      {/* Kind selector */}
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={t.kind === k}
            onClick={() => onChange({ kind: k })}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/15",
              t.kind === k
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted hover:border-border-strong",
            )}
          >
            {TICKET_KIND_LABELS[k]}
          </button>
        ))}
      </div>
      <p className="-mt-1 text-xs text-muted">{TICKET_KIND_HINTS[t.kind]}</p>

      {/* Name + primary price fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`name-${t.id}`} label="نام بلیت" required>
          <Input
            id={`name-${t.id}`}
            value={t.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="مثلاً عادی، ویژه…"
          />
        </Field>

        {priced ? (
          <Field id={`price-${t.id}`} label="قیمت (تومان)" required>
            <Input
              id={`price-${t.id}`}
              type="number"
              min={0}
              inputMode="numeric"
              value={t.price}
              onChange={(e) => onChange({ price: e.target.value })}
            />
          </Field>
        ) : null}

      </div>

      {/* Capacity + description (visible, not advanced) */}
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
                <Input
                  id={`eb-price-${t.id}`}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={t.earlyBirdPrice}
                  onChange={(e) => onChange({ earlyBirdPrice: e.target.value })}
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

        {/* دربستی — charter/whole booking: base price + per-person fee, min–max people */}
        <div className="flex flex-col gap-3">
          <Toggle
            label="فروش دربستی"
            hint="رزرو یک‌جای رویداد با قیمت پایه ثابت و هزینهٔ اضافه به‌ازای هر نفر."
            checked={t.buyout}
            onChange={(v) => onChange({ buyout: v })}
          />
          {t.buyout ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`buyout-base-${t.id}`} label="قیمت پایهٔ دربست (تومان)">
                <Input
                  id={`buyout-base-${t.id}`}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={t.buyoutBasePrice}
                  onChange={(e) => onChange({ buyoutBasePrice: e.target.value })}
                  placeholder="مثلاً ۱۰٬۰۰۰٬۰۰۰"
                />
              </Field>
              <Field id={`buyout-pp-${t.id}`} label="هزینه به‌ازای هر نفر (تومان)">
                <Input
                  id={`buyout-pp-${t.id}`}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={t.buyoutPerPerson}
                  onChange={(e) => onChange({ buyoutPerPerson: e.target.value })}
                  placeholder="مثلاً ۲۰۰٬۰۰۰"
                />
              </Field>
              <Field id={`buyout-min-${t.id}`} label="حداقل نفرات">
                <Input
                  id={`buyout-min-${t.id}`}
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={t.buyoutMin}
                  onChange={(e) => onChange({ buyoutMin: e.target.value })}
                  placeholder="مثلاً ۲۰"
                />
              </Field>
              <Field id={`buyout-max-${t.id}`} label="حداکثر نفرات">
                <Input
                  id={`buyout-max-${t.id}`}
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={t.buyoutMax}
                  onChange={(e) => onChange({ buyoutMax: e.target.value })}
                  placeholder="مثلاً ۱۰۰"
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
                        "rounded-full border px-3 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/15",
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

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {canRemove ? (
        <div className="flex justify-end border-t border-border pt-3">
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-danger"
          >
            <Trash2 className="size-4" aria-hidden />
            حذف این بلیت
          </button>
        </div>
      ) : null}
    </div>
  );
}
