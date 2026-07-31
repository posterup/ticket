"use client";

/**
 * The payout queue.
 *
 * Organisers could request a withdrawal and nothing on the platform could ever
 * advance it: `settledAt` was never written and no code path moved the status
 * off `"pending"`. The money was correctly withheld from their spendable
 * balance and then sat in a state with no exit — a queue nobody could see and
 * nobody could work.
 *
 * This does not move money either; the transfer is a bank action taken outside
 * the product. What it records is *that it happened*, which is what releases
 * the organiser from limbo and what a failed transfer needs in order to put the
 * funds back.
 */

import { useCallback, useMemo, useState } from "react";
import { Banknote, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";

import { apiFetch, ApiCallError, useApi } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { formatJalaliDate, formatNumber, formatToman } from "@/lib/format";
import { AsyncState } from "@/components/ui/async-state";
import { Button } from "@/components/ui/button";

interface Payout {
  id: string;
  workspaceName: string;
  amount: number;
  fee: number;
  status: "pending" | "processing" | "paid" | "failed";
  iban: string;
  bankName: string;
  holder: string;
  requestedAt: string;
  settledAt?: string;
}

const STATUS: Record<
  Payout["status"],
  { label: string; className: string; Icon: typeof Clock }
> = {
  pending: {
    label: "در انتظار",
    className: "bg-subtle text-muted",
    Icon: Clock,
  },
  processing: {
    label: "در حال پردازش",
    className: "bg-warning/10 text-warning-text",
    Icon: Loader2,
  },
  paid: {
    label: "واریز شد",
    className: "bg-success/10 text-success-text",
    Icon: CheckCircle2,
  },
  failed: {
    label: "ناموفق",
    className: "bg-danger/10 text-danger-text",
    Icon: XCircle,
  },
};

/** Mirrors the server's transition table; the server is still the authority. */
const NEXT: Record<Payout["status"], Payout["status"][]> = {
  pending: ["processing", "paid", "failed"],
  processing: ["paid", "failed"],
  paid: [],
  failed: [],
};

export default function AdminPayoutsPage() {
  const { data, error, loading, reload } =
    useApi<Payout[]>("/api/admin/payouts");
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const owed = useMemo(
    () =>
      (data ?? [])
        .filter((p) => p.status === "pending" || p.status === "processing")
        .reduce((sum, p) => sum + p.amount, 0),
    [data],
  );

  const advance = useCallback(
    async (id: string, status: Payout["status"]) => {
      setBusy(id);
      setFailure(null);
      try {
        await apiFetch(`/api/admin/payouts/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });
        reload();
      } catch (e) {
        setFailure(
          e instanceof ApiCallError ? e.message : "ثبت وضعیت ممکن نشد.",
        );
      } finally {
        setBusy(null);
      }
    },
    [reload],
  );

  if (!data) {
    return <AsyncState loading={loading} error={error} onRetry={reload} variant="table" rows={5} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-lg font-bold text-foreground">درخواست‌های برداشت</h1>
        <p className="text-sm text-muted">
          {formatNumber(data.length)} درخواست · {formatToman(owed)} در انتظار
          پرداخت
        </p>
      </header>

      <p className="rounded-lg bg-subtle px-3 py-2 text-xs leading-relaxed text-muted">
        ثبت وضعیت در این صفحه پولی جابه‌جا نمی‌کند؛ انتقال بانکی بیرون از سامانه
        انجام می‌شود. «ناموفق» مبلغ را به موجودی قابل برداشت فضای کاری
        بازمی‌گرداند.
      </p>

      {failure ? (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger-text">
          {failure}
        </p>
      ) : null}

      {data.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Banknote className="mx-auto mb-2 size-6 text-faint" aria-hidden />
          <p className="text-sm text-muted">درخواست برداشتی ثبت نشده است.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {data.map((p) => {
            const status = STATUS[p.status];
            return (
              <li key={p.id} className="flex flex-col gap-3 px-4 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {p.workspaceName}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {p.holder} · {p.bankName}
                    </p>
                    <p dir="ltr" className="mt-0.5 font-mono text-xs text-faint">
                      {p.iban}
                    </p>
                  </div>

                  <div className="text-end">
                    <p className="text-sm font-bold tabular-nums text-foreground">
                      {formatToman(p.amount)}
                    </p>
                    <p className="text-[11px] text-faint">
                      کارمزد {formatToman(p.fee)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium",
                      status.className,
                    )}
                  >
                    <status.Icon className="size-3" aria-hidden />
                    {status.label}
                    {p.settledAt
                      ? ` · ${formatJalaliDate(p.settledAt)}`
                      : ` · ${formatJalaliDate(p.requestedAt)}`}
                  </span>

                  <div className="flex flex-wrap gap-1.5">
                    {NEXT[p.status].map((next) => (
                      <Button
                        key={next}
                        size="sm"
                        variant={next === "paid" ? "primary" : "ghost"}
                        disabled={busy === p.id}
                        onClick={() => advance(p.id, next)}
                        className={cn(next === "failed" && "text-danger-text")}
                      >
                        {STATUS[next].label}
                      </Button>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
