"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ticket, Plus, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DateField } from "@/components/ui/date-field";
import { formatJalaliDate, formatToman, formatNumber } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/wizard/labels";
import type { TicketCategory, TicketType } from "@/types";

const CATEGORIES: TicketCategory[] = [
  "general",
  "vip",
  "student",
  "early-bird",
  "backstage",
  "group",
];

interface Props {
  eventId: string;
  tickets: TicketType[];
}

/** Ticket-types list for an event, with an inline "add ticket type" form. */
export function EventTickets({ eventId, tickets }: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Ticket className="size-4 text-faint" aria-hidden />
          انواع بلیت
        </h2>
        {!adding ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setAdding(true)}
          >
            <Plus aria-hidden />
            افزودن نوع بلیت
          </Button>
        ) : null}
      </div>

      {adding ? (
        <AddTicketForm
          eventId={eventId}
          onDone={() => {
            setAdding(false);
            router.refresh();
          }}
          onCancel={() => setAdding(false)}
        />
      ) : null}

      {tickets.length === 0 && !adding ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
          هنوز نوع بلیتی برای این رویداد تعریف نشده است.
        </p>
      ) : tickets.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {tickets.map((t) => (
            <div key={t.id} className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{t.name}</p>
                <span className="rounded-full border border-border bg-subtle px-2 py-0.5 text-xs text-muted">
                  {CATEGORY_LABELS[t.category]}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {formatToman(t.price)}
              </p>
              <dl className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3 text-xs text-muted">
                <div className="flex justify-between">
                  <dt>ظرفیت</dt>
                  <dd className="text-foreground">{formatNumber(t.capacity)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>بازه فروش</dt>
                  <dd>
                    {formatJalaliDate(t.salesStartAt)} تا{" "}
                    {formatJalaliDate(t.salesEndAt)}
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function AddTicketForm({
  eventId,
  onDone,
  onCancel,
}: {
  eventId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<TicketCategory>("general");
  const [price, setPrice] = useState("");
  const [capacity, setCapacity] = useState("");
  const [salesEnd, setSalesEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!name.trim()) return setError("نام بلیت الزامی است.");
    const p = Number(price);
    const cap = Number(capacity);
    if (!Number.isInteger(p) || p < 0) return setError("قیمت نامعتبر است.");
    if (!Number.isInteger(cap) || cap < 0) return setError("ظرفیت نامعتبر است.");

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          name: name.trim(),
          price: p,
          capacity: cap,
          category,
          salesStartAt: new Date().toISOString(),
          salesEndAt: salesEnd
            ? `${salesEnd}T23:59:00.000Z`
            : new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error("خطا در ساخت بلیت.");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای ناشناخته رخ داد.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="t-name" label="نام بلیت" required>
          <Input
            id="t-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثلاً عمومی"
          />
        </Field>
        <Field id="t-cat" label="دسته">
          <Select
            id="t-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value as TicketCategory)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="t-price" label="قیمت (تومان)" required>
          <Input
            id="t-price"
            type="number"
            inputMode="numeric"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="۰ برای رایگان"
          />
        </Field>
        <Field id="t-cap" label="ظرفیت" required>
          <Input
            id="t-cap"
            type="number"
            inputMode="numeric"
            min={0}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field id="t-end" label="پایان فروش (اختیاری)">
            <DateField id="t-end" value={salesEnd} onChange={setSalesEnd} />
          </Field>
        </div>
      </div>
      {error ? <p className="mt-3 text-xs text-danger">{error}</p> : null}
      <div className="mt-4 flex items-center gap-2">
        <Button type="button" size="sm" onClick={save} disabled={saving}>
          <Check aria-hidden />
          {saving ? "در حال ذخیره…" : "ذخیره بلیت"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={saving}
        >
          <X aria-hidden />
          انصراف
        </Button>
      </div>
    </div>
  );
}
