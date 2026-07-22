"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Tag, X, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatToman, formatNumber } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/wizard/labels";
import type { DiscountKind, DiscountValidation, TicketCategory } from "@/types";

export interface CheckoutTicket {
  id: string;
  name: string;
  price: number;
  capacity: number;
  category: TicketCategory;
}

interface CheckoutFormProps {
  eventId: string;
  eventTitle: string;
  tickets: CheckoutTicket[];
  initialTicketId: string;
}

interface AppliedDiscount {
  code: string;
  kind: DiscountKind;
  value: number;
}

/** Recompute the discount for the current subtotal (mirrors the server rule). */
function discountFor(applied: AppliedDiscount | null, subtotal: number): number {
  if (!applied || subtotal <= 0) return 0;
  const raw =
    applied.kind === "percent"
      ? Math.floor((subtotal * applied.value) / 100)
      : applied.value;
  return Math.max(0, Math.min(raw, subtotal));
}

export function CheckoutForm({
  eventId,
  eventTitle,
  tickets,
  initialTicketId,
}: CheckoutFormProps) {
  const [ticketId, setTicketId] = useState(initialTicketId);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [orderCode, setOrderCode] = useState<string | null>(null);

  const [promo, setPromo] = useState("");
  const [applied, setApplied] = useState<AppliedDiscount | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const ticket = tickets.find((t) => t.id === ticketId) ?? tickets[0];
  const maxQty = Math.min(ticket.capacity, 10);
  const qtyNum = Number.parseInt(quantity, 10) || 0;
  const subtotal = ticket.price * (qtyNum > 0 ? qtyNum : 0);
  const discountAmount = discountFor(applied, subtotal);
  const total = subtotal - discountAmount;

  async function applyPromo() {
    const code = promo.trim();
    if (!code) return;
    setPromoLoading(true);
    setPromoError(null);
    try {
      const res = await fetch("/api/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, eventId, subtotal }),
      });
      const json = (await res.json()) as { data?: DiscountValidation };
      const result = json.data;
      if (result && result.ok) {
        setApplied({ code: result.code, kind: result.kind, value: result.value });
        setPromoError(null);
      } else {
        setApplied(null);
        setPromoError(result?.reason ?? "کد تخفیف معتبر نیست.");
      }
    } catch {
      setPromoError("خطا در بررسی کد تخفیف. دوباره تلاش کنید.");
    } finally {
      setPromoLoading(false);
    }
  }

  function removePromo() {
    setApplied(null);
    setPromo("");
    setPromoError(null);
  }

  function submit() {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "نام و نام خانوادگی الزامی است.";
    if (!/^(\+98|0)?9\d{9}$/.test(phone.trim().replace(/\s/g, ""))) {
      next.phone = "شماره موبایل معتبر وارد کنید.";
    }
    if (qtyNum < 1 || qtyNum > maxQty) {
      next.quantity = `تعداد باید بین ۱ و ${formatNumber(maxQty)} باشد.`;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    // Mock order: no payment gateway yet (finance epic).
    setOrderCode(crypto.randomUUID().slice(0, 8).toUpperCase());
  }

  if (orderCode) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <span className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="size-8" aria-hidden />
        </span>
        <h2 className="text-xl font-bold text-foreground">سفارش شما ثبت شد</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          {`کد پیگیری: ${orderCode} — بلیت «${ticket.name}» برای «${eventTitle}».`}
        </p>
        {applied ? (
          <p className="mx-auto mt-1 max-w-sm text-xs text-success">
            {`کد تخفیف «${applied.code}» اعمال شد؛ مبلغ پرداختی ${formatToman(total)}.`}
          </p>
        ) : null}
        <p className="mx-auto mt-1 max-w-sm text-xs text-faint">
          این نسخه نمایشی است؛ درگاه پرداخت آنلاین به‌زودی افزوده می‌شود.
        </p>
        <div className="mt-6">
          <Link
            href={`/events/${eventId}`}
            className="text-sm font-medium text-muted underline-offset-4 hover:text-foreground hover:underline"
          >
            بازگشت به رویداد
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-6 rounded-lg border border-border bg-card p-6">
        <Field id="ticket" label="نوع بلیت">
          <Select
            id="ticket"
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value)}
          >
            {tickets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {CATEGORY_LABELS[t.category]} · {formatToman(t.price)}
              </option>
            ))}
          </Select>
        </Field>

        <Field id="name" label="نام و نام خانوادگی" required error={errors.name}>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(errors.name)}
          />
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field id="phone" label="شماره موبایل" required error={errors.phone}>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={Boolean(errors.phone)}
              placeholder="09123456789"
            />
          </Field>
          <Field id="quantity" label="تعداد" required error={errors.quantity}>
            <Input
              id="quantity"
              type="number"
              min={1}
              max={maxQty}
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              aria-invalid={Boolean(errors.quantity)}
            />
          </Field>
        </div>
      </div>

      <aside className="flex h-fit flex-col gap-4 rounded-lg border border-border bg-subtle p-6">
        <h2 className="text-sm font-semibold text-foreground">خلاصه سفارش</h2>

        {/* Promo code */}
        <div className="flex flex-col gap-2">
          {applied ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2">
              <span className="flex items-center gap-1.5 text-sm font-medium text-success">
                <Tag className="size-4" aria-hidden />
                {applied.code}
              </span>
              <button
                type="button"
                onClick={removePromo}
                className="text-success/80 hover:text-success"
                aria-label="حذف کد تخفیف"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ) : (
            <div className="flex items-stretch gap-2">
              <Input
                id="promo"
                value={promo}
                onChange={(e) => {
                  setPromo(e.target.value);
                  if (promoError) setPromoError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void applyPromo();
                  }
                }}
                placeholder="کد تخفیف"
                aria-label="کد تخفیف"
                aria-invalid={Boolean(promoError)}
                className="uppercase"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => void applyPromo()}
                disabled={promoLoading || !promo.trim()}
              >
                {promoLoading ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  "اعمال"
                )}
              </Button>
            </div>
          )}
          {promoError ? (
            <p className="text-xs text-danger">{promoError}</p>
          ) : null}
        </div>

        <dl className="flex flex-col gap-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">بلیت</dt>
            <dd className="text-foreground">{ticket.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">قیمت واحد</dt>
            <dd className="text-foreground">{formatToman(ticket.price)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">تعداد</dt>
            <dd className="text-foreground">{formatNumber(qtyNum)}</dd>
          </div>
          {discountAmount > 0 ? (
            <>
              <div className="flex justify-between">
                <dt className="text-muted">جمع جزء</dt>
                <dd className="text-foreground">{formatToman(subtotal)}</dd>
              </div>
              <div className="flex justify-between text-success">
                <dt>تخفیف{applied ? ` (${applied.code})` : ""}</dt>
                <dd>−{formatToman(discountAmount)}</dd>
              </div>
            </>
          ) : null}
        </dl>
        <div className="flex justify-between border-t border-border pt-3 text-sm font-semibold">
          <span className="text-muted">مبلغ کل</span>
          <span className="text-foreground">{formatToman(total)}</span>
        </div>
        <Button type="button" size="lg" onClick={submit}>
          ثبت سفارش
        </Button>
      </aside>
    </div>
  );
}
