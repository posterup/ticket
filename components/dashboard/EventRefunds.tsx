"use client";

/**
 * Who is still owed money.
 *
 * Cancelling a show is one click; making a hundred buyers whole is not. Without
 * a worklist the organiser reconstructs "who paid for the sancé I just called
 * off" from the orders list by hand, which is how people get missed — and the
 * platform has already texted every one of them that their money is coming
 * back.
 *
 * Recording a refund here does **not** move any money: Iranian gateways settle
 * to the organiser, so the transfer is theirs to make. What this owns is the
 * consequence — the order stops being a sale, the tickets stop admitting
 * anyone, and the seats go back on sale for the next buyer. Saying so plainly
 * matters, because a button labelled «بازپرداخت» that quietly did nothing to
 * the bank would be worse than no button.
 */

import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, RotateCcw, Undo2, UserCheck } from "lucide-react";

import { apiFetch, ApiCallError, useApi } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { formatNumber, formatToman } from "@/lib/format";
import { AsyncState } from "@/components/ui/async-state";
import { Button } from "@/components/ui/button";

interface Candidate {
  orderId: string;
  code: string;
  buyerName: string;
  buyerPhone: string;
  total: number;
  tickets: number;
  checkedIn: number;
}

export function EventRefunds({ eventId }: { eventId: string }) {
  const { data: payload, error, loading, reload } = useApi<{
    orders: Candidate[];
    reach: { people: number; tickets: number };
  }>(`/api/events/${eventId}/refunds`);
  const data = payload?.orders;
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const owed = useMemo(
    () => (data ?? []).reduce((sum, c) => sum + c.total, 0),
    [data],
  );

  const refund = useCallback(
    async (orderId: string) => {
      setBusy(orderId);
      setFailure(null);
      try {
        await apiFetch(`/api/orders/${orderId}/refund`, { method: "POST" });
        setConfirming(null);
        reload();
      } catch (e) {
        setFailure(
          e instanceof ApiCallError ? e.message : "ثبت بازپرداخت ممکن نشد.",
        );
      } finally {
        setBusy(null);
      }
    },
    [reload],
  );

  if (!data) {
    return <AsyncState loading={loading} error={error} onRetry={reload} variant="table" rows={4} />;
  }

  if (!data.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <RotateCcw className="mx-auto mb-2 size-6 text-faint" aria-hidden />
        <p className="text-sm text-muted">سفارش پرداخت‌شده‌ای بدون تسویه نیست.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-foreground">بازپرداخت</h3>
        <p className="text-xs text-muted">
          {formatNumber(data.length)} سفارش · {formatToman(owed)}
        </p>
      </div>

      <p className="rounded-lg bg-subtle px-3 py-2 text-[11px] leading-relaxed text-muted">
        ثبت بازپرداخت پول را جابه‌جا نمی‌کند؛ انتقال وجه با شماست. با ثبت آن،
        بلیت‌ها باطل می‌شوند، صندلی‌ها دوباره به فروش می‌روند و به خریدار پیامک
        می‌رود.
      </p>

      {failure ? (
        <p
          role="alert"
          className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger-text"
        >
          {failure}
        </p>
      ) : null}

      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {data.map((c) => (
          <li key={c.orderId} className="flex flex-col gap-3 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {c.buyerName}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                  <span dir="ltr">{c.buyerPhone}</span>
                  <span aria-hidden>·</span>
                  <span dir="ltr">{c.code}</span>
                  <span aria-hidden>·</span>
                  {formatNumber(c.tickets)} بلیت
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                {formatToman(c.total)}
              </span>
            </div>

            {c.checkedIn > 0 ? (
              // Refunding someone who already walked in is allowed — the second
              // half of a cancelled double bill is exactly that — but it should
              // never happen by accident.
              <p className="flex items-center gap-1.5 rounded-md bg-warning/10 px-2 py-1 text-[11px] text-warning-text">
                <UserCheck className="size-3.5 shrink-0" aria-hidden />
                {formatNumber(c.checkedIn)} بلیت از این سفارش قبلاً وارد شده است.
              </p>
            ) : null}

            {confirming === c.orderId ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-subtle px-3 py-2">
                <AlertTriangle
                  className="size-4 shrink-0 text-warning-text"
                  aria-hidden
                />
                <span className="text-xs text-foreground">
                  بلیت‌ها باطل و صندلی‌ها آزاد می‌شوند. مطمئنید؟
                </span>
                <div className="ms-auto flex gap-2">
                  <Button
                    size="sm"
                    disabled={busy === c.orderId}
                    onClick={() => refund(c.orderId)}
                  >
                    {busy === c.orderId ? "در حال ثبت…" : "بله، ثبت کن"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirming(null)}
                  >
                    انصراف
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirming(c.orderId)}
                  className={cn(c.checkedIn > 0 && "text-warning-text")}
                >
                  <Undo2 aria-hidden />
                  ثبت بازپرداخت
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
