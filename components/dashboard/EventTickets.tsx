"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ticket, Plus, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
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
