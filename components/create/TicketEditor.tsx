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

const KINDS: TicketKind[] = ["paid", "free", "donation", "group", "addon"];

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

        {t.kind === "donation" ? (
          <Field id={`min-${t.id}`} label="حداقل مبلغ (تومان)">
            <Input
              id={`min-${t.id}`}
              type="number"
              min={0}
              inputMode="numeric"
              value={t.minPrice}
              onChange={(e) => onChange({ minPrice: e.target.value })}
              placeholder="۰"
            />
          </Field>
        ) : null}

        {t.kind === "group" ? (
          <>
            <Field id={`gprice-${t.id}`} label="قیمت بسته (تومان)" required>
              <Input
                id={`gprice-${t.id}`}
                type="number"
                min={0}
                inputMode="numeric"
                value={t.price}
                onChange={(e) => onChange({ price: e.target.value })}
              />
            </Field>
            <Field id={`gsize-${t.id}`} label="تعداد افراد در بسته" required>
              <Input
                id={`gsize-${t.id}`}
                type="number"
                min={2}
                inputMode="numeric"
                value={t.groupSize}
                onChange={(e) => onChange({ groupSize: e.target.value })}
              />
            </Field>
          </>
        ) : null}
      </div>

      {/* Advanced */}
      <Disclosure label="گزینه‌های پیشرفته">
        <div className="grid gap-4 sm:grid-cols-3">
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

        <Field id={`desc-${t.id}`} label="توضیحات">
          <Textarea
            id={`desc-${t.id}`}
            rows={2}
            value={t.description}
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </Field>

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

        {/* Hidden / access-code */}
        <div className="flex flex-col gap-3">
          <Toggle
            label="بلیت پنهان (با کد دسترسی)"
            hint="در صفحهٔ رویداد نمایش داده نمی‌شود؛ فقط با کد قابل خرید است."
            checked={t.hidden}
            onChange={(v) => onChange({ hidden: v })}
          />
          {t.hidden ? (
            <Field id={`code-${t.id}`} label="کد دسترسی بلیت">
              <Input
                id={`code-${t.id}`}
                value={t.accessCode}
                onChange={(e) => onChange({ accessCode: e.target.value })}
                dir="ltr"
                placeholder="مثلاً VIP2026"
              />
            </Field>
          ) : null}
        </div>
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
