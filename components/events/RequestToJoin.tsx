"use client";

/**
 * Request to join an approval-gated event.
 *
 * When an organiser turns on «تأیید میزبان», buying is not the next step —
 * asking is. This posts a registration and stops there; no order, no payment,
 * nothing to refund if the host says no. The host accepts or rejects from the
 * dashboard, and the attendee is told either way.
 *
 * Previously the buy button on such an event linked straight to checkout, which
 * created a paid order and skipped approval entirely.
 */

import { useState } from "react";
import { CheckCircle2, UserCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/format";

interface Props {
  eventId: string;
  /** Prefilled for a signed-in visitor, so they only confirm. */
  defaultName?: string;
  defaultPhone?: string;
  label: string;
}

const MAX_TICKETS = 20;

export function RequestToJoin({
  eventId,
  defaultName = "",
  defaultPhone = "",
  label,
}: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [tickets, setTickets] = useState("1");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    const count = Number.parseInt(tickets, 10) || 0;
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "نام و نام خانوادگی الزامی است.";
    if (!/^(\+98|0)?9\d{9}$/.test(phone.trim().replace(/\s/g, ""))) {
      next.phone = "شماره موبایل معتبر وارد کنید.";
    }
    if (count < 1 || count > MAX_TICKETS) {
      next.tickets = `تعداد باید بین ۱ و ${formatNumber(MAX_TICKETS)} باشد.`;
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/events/${eventId}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim().replace(/\s/g, ""),
          tickets: count,
        }),
      });
      const json = await res.json();
      if (!res.ok || !("data" in json)) {
        setErrors({ form: json?.error?.message ?? "ثبت درخواست انجام نشد. دوباره تلاش کنید." });
        return;
      }
      setSent(true);
    } catch {
      setErrors({ form: "ارتباط با سرور برقرار نشد. دوباره تلاش کنید." });
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-lg bg-success/10 p-4 text-center">
        <CheckCircle2
          className="mx-auto mb-2 size-6 text-success-text"
          aria-hidden
        />
        <p className="text-sm font-medium text-foreground">درخواست شما ثبت شد</p>
        <p className="mt-1 text-xs text-muted">
          پس از بررسی میزبان، نتیجه برایتان پیامک می‌شود.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="lg" className="w-full">
        <UserCheck aria-hidden />
        {label}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Field id="join-name" label="نام و نام خانوادگی" required error={errors.name}>
        <Input
          id="join-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="نام کامل"
        />
      </Field>

      <Field id="join-phone" label="شماره موبایل" required error={errors.phone}>
        <Input
          id="join-phone"
          dir="ltr"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="09xxxxxxxxx"
        />
      </Field>

      <Field id="join-tickets" label="تعداد بلیت" error={errors.tickets}>
        <Input
          id="join-tickets"
          type="number"
          min={1}
          max={MAX_TICKETS}
          inputMode="numeric"
          value={tickets}
          onChange={(e) => setTickets(e.target.value)}
        />
      </Field>

      {errors.form ? (
        <p role="alert" className="text-xs text-danger-text">
          {errors.form}
        </p>
      ) : null}

      <Button onClick={submit} disabled={submitting} className="w-full">
        {submitting ? "در حال ارسال…" : "ارسال درخواست"}
      </Button>
      <p className="text-[11px] leading-relaxed text-faint">
        این درخواست پرداختی ندارد. در صورت تأیید میزبان، برای پرداخت خبرتان
        می‌کنیم.
      </p>
    </div>
  );
}
