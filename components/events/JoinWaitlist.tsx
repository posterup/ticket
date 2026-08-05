"use client";

/**
 * Join the waitlist for a sold-out event.
 *
 * Distinct from «خبرم کن», which is interest in an event that has not opened.
 * This is a place in a queue, and the difference is what the person is told
 * when stock reappears: a notify subscriber hears the event exists, someone on
 * the waitlist hears that their turn has come.
 *
 * The position is shown honestly, including the caveat that a place is not a
 * reservation — the platform notifies in order but does not hold seats for
 * someone who may never open the message.
 */

import { useState } from "react";
import { ListOrdered, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/format";

interface Place {
  position: number;
  quantity: number;
  total: number;
}

export function JoinWaitlist({
  eventId,
  label,
  viewer,
}: {
  eventId: string;
  label: string;
  /** Signed-in visitor's details, prefilled and still editable. */
  viewer?: { fullName: string; phone: string };
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(viewer?.fullName ?? "");
  const [phone, setPhone] = useState(viewer?.phone ?? "");
  const [quantity, setQuantity] = useState("1");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);

  async function submit() {
    const count = Number.parseInt(quantity, 10) || 0;
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "نام و نام خانوادگی الزامی است.";
    if (!/^(\+98|0)?9\d{9}$/.test(phone.trim().replace(/\s/g, ""))) {
      next.phone = "شماره موبایل معتبر وارد کنید.";
    }
    if (count < 1 || count > 20) next.quantity = "تعداد بین ۱ تا ۲۰ باشد.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/events/${eventId}/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim().replace(/\s/g, ""),
          quantity: count,
        }),
      });
      const json = await res.json();
      if (!res.ok || !("data" in json)) {
        setErrors({ form: json?.error?.message ?? "ثبت در لیست انتظار انجام نشد. دوباره تلاش کنید." });
        return;
      }
      setPlace(json.data as Place);
    } catch {
      setErrors({ form: "ارتباط با سرور برقرار نشد. دوباره تلاش کنید." });
    } finally {
      setSubmitting(false);
    }
  }

  if (place) {
    return (
      <div className="rounded-lg bg-subtle p-4 text-center">
        <CheckCircle2
          className="mx-auto mb-2 size-6 text-success-text"
          aria-hidden
        />
        <p className="text-sm font-medium text-foreground">
          نفر {formatNumber(place.position)} از {formatNumber(place.total)}
        </p>
        <p className="mt-1 text-xs text-muted">
          اگر جای خالی پیدا شود، به‌ترتیب نوبت پیامک می‌شود.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-faint">
          جای شما در صف رزرو بلیت نیست؛ هرکس زودتر خرید کند، بلیت را می‌گیرد.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="lg" className="w-full">
        <ListOrdered aria-hidden />
        {label}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Field id="wl-name" label="نام و نام خانوادگی" required error={errors.name}>
        <Input
          id="wl-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="نام کامل"
        />
      </Field>

      <Field id="wl-phone" label="شماره موبایل" required error={errors.phone}>
        <Input
          id="wl-phone"
          dir="ltr"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="09xxxxxxxxx"
        />
      </Field>

      <Field id="wl-qty" label="چند بلیت می‌خواهید؟" error={errors.quantity}>
        <Input
          id="wl-qty"
          type="number"
          min={1}
          max={20}
          inputMode="numeric"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </Field>

      {errors.form ? (
        <p role="alert" className="text-xs text-danger-text">
          {errors.form}
        </p>
      ) : null}

      <Button onClick={submit} disabled={submitting} className="w-full">
        {submitting ? "در حال ثبت…" : "ثبت در لیست انتظار"}
      </Button>
    </div>
  );
}
