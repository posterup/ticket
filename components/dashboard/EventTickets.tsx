"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ticket, Plus, Pencil, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Textarea } from "@/components/ui/textarea";
import { DateField } from "@/components/ui/date-field";
import { formatJalaliDate, formatToman, formatNumber } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/wizard/labels";
import { TicketEditor, type SessionOption } from "@/components/create/TicketEditor";
import { emptyTicket, type TicketTypeDraft } from "@/lib/create/types";
import type { TicketType } from "@/types";

interface Props {
  eventId: string;
  tickets: TicketType[];
  sessions: SessionOption[];
}

/** Price a draft resolves to (mirrors the composer's submit mapping). */
function ticketPrice(t: TicketTypeDraft): number {
  if (t.kind === "free") return 0;
  if (t.kind === "donation") return Math.max(0, Math.floor(Number(t.minPrice) || 0));
  return Math.max(0, Math.floor(Number(t.price) || 0));
}

function iso(date: string, time: string): string {
  return `${date}T${time}:00.000Z`;
}

/** Ticket-types list for an event, with an inline full "add ticket type" editor. */
export function EventTickets({ eventId, tickets, sessions }: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
          sessions={sessions}
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
          {tickets.map((t) =>
            editingId === t.id ? (
              <EditTicketForm
                key={t.id}
                ticket={t}
                onDone={() => {
                  setEditingId(null);
                  router.refresh();
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div key={t.id} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{t.name}</p>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full border border-border bg-subtle px-2 py-0.5 text-xs text-muted">
                      {CATEGORY_LABELS[t.category]}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingId(t.id)}
                    >
                      <Pencil aria-hidden />
                      ویرایش
                    </Button>
                  </div>
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
            ),
          )}
        </div>
      ) : null}
    </section>
  );
}

/** Inline editor for one existing ticket type, mirroring the read-only card. */
function EditTicketForm({
  ticket,
  onDone,
  onCancel,
}: {
  ticket: TicketType;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: ticket.name,
    price: String(ticket.price),
    capacity: String(ticket.capacity),
    salesStart: ticket.salesStartAt.slice(0, 10),
    salesEnd: ticket.salesEndAt.slice(0, 10),
    description: ticket.description ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!form.name.trim()) return setError("نام بلیت الزامی است.");
    if (form.salesStart && form.salesEnd && form.salesEnd < form.salesStart) {
      return setError("پایان فروش نباید پیش از شروع آن باشد.");
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          price: Math.max(0, Math.floor(Number(form.price) || 0)),
          capacity: Math.max(0, Math.floor(Number(form.capacity) || 0)),
          ...(form.salesStart
            ? { salesStartAt: iso(form.salesStart, "00:00") }
            : {}),
          ...(form.salesEnd ? { salesEndAt: iso(form.salesEnd, "23:59") } : {}),
          description: form.description.trim(),
        }),
      });
      if (!res.ok) throw new Error("خطا در ذخیرهٔ بلیت.");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای ناشناخته رخ داد.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-4">
        <Field id={`t-name-${ticket.id}`} label="نام بلیت" required>
          <Input
            id={`t-name-${ticket.id}`}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`t-price-${ticket.id}`} label="قیمت (تومان)">
            <MoneyInput
              id={`t-price-${ticket.id}`}
              value={form.price}
              onChange={(v) => setForm((f) => ({ ...f, price: v }))}
            />
          </Field>
          <Field id={`t-cap-${ticket.id}`} label="ظرفیت">
            <Input
              id={`t-cap-${ticket.id}`}
              type="number"
              min={0}
              value={form.capacity}
              onChange={(e) =>
                setForm((f) => ({ ...f, capacity: e.target.value }))
              }
            />
          </Field>
          <Field id={`t-start-${ticket.id}`} label="شروع فروش">
            <DateField
              id={`t-start-${ticket.id}`}
              value={form.salesStart}
              onChange={(v) => setForm((f) => ({ ...f, salesStart: v }))}
            />
          </Field>
          <Field id={`t-end-${ticket.id}`} label="پایان فروش">
            <DateField
              id={`t-end-${ticket.id}`}
              value={form.salesEnd}
              onChange={(v) => setForm((f) => ({ ...f, salesEnd: v }))}
            />
          </Field>
        </div>
        <Field id={`t-desc-${ticket.id}`} label="توضیحات">
          <Textarea
            id={`t-desc-${ticket.id}`}
            rows={2}
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />
        </Field>
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
            onClick={onCancel}
            disabled={saving}
          >
            <X aria-hidden />
            انصراف
          </Button>
        </div>
      </div>
    </div>
  );
}

function AddTicketForm({
  eventId,
  sessions,
  onDone,
  onCancel,
}: {
  eventId: string;
  sessions: SessionOption[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<TicketTypeDraft>(() =>
    emptyTicket("new-ticket"),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function validate(t: TicketTypeDraft): string | null {
    if (!t.name.trim()) return "نام بلیت الزامی است.";
    const priced = t.kind === "paid" || t.kind === "group" || t.kind === "addon";
    if (priced && !(Number(t.price) > 0)) return "قیمت را وارد کنید.";
    if (t.kind === "donation" && Number(t.minPrice) < 0) return "حداقل مبلغ نامعتبر است.";
    return null;
  }

  async function save() {
    const msg = validate(draft);
    if (msg) return setError(msg);
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          name: draft.name.trim(),
          price: ticketPrice(draft),
          capacity: Math.max(0, Math.floor(Number(draft.capacity) || 0)),
          category: draft.kind === "group" ? "group" : "general",
          salesStartAt:
            draft.salesSchedule && draft.salesStart
              ? iso(draft.salesStart, "00:00")
              : new Date().toISOString(),
          salesEndAt:
            draft.salesSchedule && draft.salesEnd
              ? iso(draft.salesEnd, "23:59")
              : new Date().toISOString(),
          description: draft.description.trim() || undefined,
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
    <div className="flex flex-col gap-4">
      <TicketEditor
        ticket={draft}
        sessions={sessions}
        canRemove={false}
        onChange={(p) => setDraft((d) => ({ ...d, ...p }))}
        onRemove={() => {}}
      />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex items-center gap-2">
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
