"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tag, Plus, Check, Percent, Coins, Infinity as InfinityIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DateField } from "@/components/ui/date-field";
import { formatNumber, formatToman, formatJalaliDate } from "@/lib/format";
import type { DiscountCode, DiscountKind } from "@/types";

export interface DiscountSessionOption {
  id: string;
  label: string;
}

const KINDS: { value: DiscountKind; label: string; icon: typeof Percent }[] = [
  { value: "percent", label: "درصدی", icon: Percent },
  { value: "fixed", label: "مبلغ ثابت", icon: Coins },
];

type Status = "active" | "expired" | "full";

function statusOf(d: DiscountCode): Status {
  if (!d.active) return "expired";
  if (d.expiresAt && new Date(d.expiresAt).getTime() < Date.now()) return "expired";
  if (d.maxRedemptions !== null && d.redemptions >= d.maxRedemptions) return "full";
  return "active";
}

const STATUS_META: Record<Status, { label: string; dot: string; text: string }> = {
  active: { label: "فعال", dot: "bg-success", text: "text-muted" },
  expired: { label: "منقضی", dot: "bg-faint", text: "text-faint" },
  full: { label: "تکمیل", dot: "bg-warning", text: "text-muted" },
};

function valueLabel(d: DiscountCode): string {
  return d.kind === "percent" ? `${formatNumber(d.value)}٪` : formatToman(d.value);
}

interface Props {
  eventId: string;
  sessions: DiscountSessionOption[];
  discounts: DiscountCode[];
}

/** Per-event discount codes: create (whole event or a single سانس) and list. */
export function EventDiscounts({ eventId, sessions, discounts }: Props) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [scope, setScope] = useState("event"); // "event" or a session id
  const [kind, setKind] = useState<DiscountKind>("percent");
  const [value, setValue] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiry, setExpiry] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const scopeLabel = (d: DiscountCode) =>
    d.sessionId
      ? sessions.find((s) => s.id === d.sessionId)?.label ?? "یک سانس"
      : "کل رویداد";

  async function create() {
    const next: Record<string, string> = {};
    const cleanCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,20}$/.test(cleanCode)) {
      next.code = "کد باید ۳ تا ۲۰ حرف یا رقم انگلیسی باشد.";
    }
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
      next.value = "مقدار تخفیف را وارد کنید.";
    } else if (kind === "percent" && num > 100) {
      next.value = "درصد تخفیف نمی‌تواند بیش از ۱۰۰ باشد.";
    }
    const max = maxRedemptions.trim() === "" ? null : Number(maxRedemptions);
    if (max !== null && (!Number.isInteger(max) || max <= 0)) {
      next.max = "سقف استفاده باید عددی مثبت باشد.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          sessionId: scope === "event" ? null : scope,
          code: cleanCode,
          kind,
          value: Math.floor(num),
          maxRedemptions: max,
          expiresAt: expiry ? `${expiry}T20:30:00.000Z` : null,
        }),
      });
      if (res.status === 409) {
        setErrors({ code: "این کد قبلاً ثبت شده است." });
        return;
      }
      if (!res.ok) throw new Error("خطا در ساخت کد تخفیف.");
      setCode("");
      setValue("");
      setMaxRedemptions("");
      setExpiry("");
      router.refresh();
    } catch {
      setErrors({ code: "خطا در ساخت کد تخفیف." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Tag className="size-4 text-faint" aria-hidden />
        کدهای تخفیف
      </h2>

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        {/* Create form */}
        <div className="flex h-fit flex-col gap-5 rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground">کد تخفیف جدید</h3>

          <Field id="d-code" label="کد" required error={errors.code}>
            <Input
              id="d-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              dir="ltr"
              placeholder="WELCOME10"
              className="uppercase"
              aria-invalid={Boolean(errors.code)}
            />
          </Field>

          <Field id="d-scope" label="محدودهٔ اعمال">
            <Select id="d-scope" value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="event">کل رویداد</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">نوع تخفیف</span>
            <div className="grid grid-cols-2 gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  aria-pressed={kind === k.value}
                  onClick={() => setKind(k.value)}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/15",
                    kind === k.value
                      ? "border-foreground bg-subtle text-foreground"
                      : "border-border text-muted hover:border-border-strong",
                  )}
                >
                  <k.icon className="size-4" aria-hidden />
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          <Field
            id="d-value"
            label={kind === "percent" ? "درصد تخفیف" : "مبلغ تخفیف (تومان)"}
            required
            error={errors.value}
          >
            <Input
              id="d-value"
              type="number"
              inputMode="numeric"
              min={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={kind === "percent" ? "۱۰" : "۵۰۰۰۰۰"}
              aria-invalid={Boolean(errors.value)}
            />
          </Field>

          <Field
            id="d-max"
            label="سقف استفاده (اختیاری)"
            error={errors.max}
            hint="خالی بگذارید تا نامحدود باشد."
          >
            <Input
              id="d-max"
              type="number"
              inputMode="numeric"
              min={1}
              value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(e.target.value)}
              placeholder="نامحدود"
              aria-invalid={Boolean(errors.max)}
            />
          </Field>

          <Field id="d-expiry" label="تاریخ انقضا (اختیاری)">
            <DateField id="d-expiry" value={expiry} onChange={setExpiry} />
          </Field>

          <Button type="button" onClick={create} disabled={saving}>
            <Plus aria-hidden />
            {saving ? "در حال ذخیره…" : "ساخت کد تخفیف"}
          </Button>
        </div>

        {/* Code list */}
        <div className="flex flex-col gap-3">
          {discounts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted">
              هنوز کد تخفیفی برای این رویداد نساخته‌اید.
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {discounts.map((d) => {
                const status = statusOf(d);
                const meta = STATUS_META[status];
                return (
                  <li
                    key={d.id}
                    className="flex items-start justify-between gap-4 px-5 py-4"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Tag className="size-4 text-faint" aria-hidden />
                        <span dir="ltr">{d.code}</span>
                        <span className="rounded-md bg-subtle px-2 py-0.5 text-xs font-medium text-muted">
                          {valueLabel(d)}
                        </span>
                      </p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                        <span>{scopeLabel(d)}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          {d.maxRedemptions === null ? (
                            <>
                              <InfinityIcon className="size-3.5 text-faint" aria-hidden />
                              {formatNumber(d.redemptions)} استفاده
                            </>
                          ) : (
                            `${formatNumber(d.redemptions)} از ${formatNumber(d.maxRedemptions)} استفاده`
                          )}
                        </span>
                        {d.expiresAt ? (
                          <>
                            <span>·</span>
                            <span>تا {formatJalaliDate(d.expiresAt)}</span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-subtle px-2.5 py-1 text-xs",
                        meta.text,
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", meta.dot)} />
                      {meta.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
