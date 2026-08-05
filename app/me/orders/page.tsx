"use client";

/**
 * The buyer's order history.
 *
 * `/api/me/orders` and `/api/orders/:id/cancel` both existed with nothing
 * rendering them, so a signed-in buyer could see issued tickets but never the
 * orders behind them — and an abandoned checkout sat holding inventory with no
 * way to let it go.
 *
 * Distinct from «بلیت‌های من», which lists what you can walk in with. This
 * lists what you asked for, including the attempts that did not become
 * tickets: awaiting payment, expired, failed, cancelled.
 */

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Clock, Receipt, XCircle } from "lucide-react";

import { apiFetch, ApiCallError, useApi } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { formatJalaliDate, formatNumber, formatTime, formatToman } from "@/lib/format";
import { AsyncState } from "@/components/ui/async-state";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import type { Order, OrderStatus } from "@/types";

const STATUS: Record<OrderStatus, { label: string; className: string }> = {
  "pending-payment": {
    label: "در انتظار پرداخت",
    className: "bg-warning/10 text-warning-text",
  },
  paid: { label: "پرداخت‌شده", className: "bg-success/10 text-success-text" },
  expired: { label: "منقضی", className: "bg-subtle text-muted" },
  failed: { label: "ناموفق", className: "bg-danger/10 text-danger-text" },
  cancelled: { label: "لغو شده", className: "bg-subtle text-muted" },
  refunded: { label: "بازپرداخت", className: "bg-subtle text-muted" },
};

export default function MyOrdersPage() {
  const { data, error, loading, reload } = useApi<Order[]>("/api/me/orders");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const orders = useMemo(() => data ?? [], [data]);

  const cancel = useCallback(
    async (id: string) => {
      setCancelling(id);
      setFailure(null);
      try {
        await apiFetch(`/api/orders/${id}/cancel`, { method: "POST" });
        // Cancelling releases seats and inventory server-side, so the whole
        // list is refetched rather than patched locally.
        reload();
      } catch (e) {
        setFailure(
          e instanceof ApiCallError ? e.message : "لغو سفارش ممکن نشد.",
        );
      } finally {
        setCancelling(null);
      }
    },
    [reload],
  );

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-6 flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            سفارش‌های من
          </h1>
          <Link
            href="/me/tickets"
            className="text-sm text-accent-text underline-offset-4 hover:underline"
          >
            بلیت‌های من
          </Link>
        </header>

        {!data ? (
          <AsyncState loading={loading} error={error} onRetry={reload} variant="list" rows={3} />
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <Receipt className="mx-auto mb-3 size-8 text-faint" aria-hidden />
            <p className="text-sm text-muted">هنوز سفارشی ثبت نکرده‌اید.</p>
            <Link
              href="/events"
              className="mt-4 inline-block text-sm font-medium text-accent-text underline-offset-4 hover:underline"
            >
              کاوش رویدادها
            </Link>
          </div>
        ) : (
          <>
            {failure ? (
              <p role="alert" className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger-text">
                {failure}
              </p>
            ) : null}

            <ul className="flex flex-col gap-3">
              {orders.map((o) => {
                const status = STATUS[o.status];
                const open = o.status === "pending-payment";
                const expiresSoon =
                  open && new Date(o.expiresAt).getTime() > Date.now();

                return (
                  <li
                    key={o.id}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground">
                          کد پیگیری {o.code}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {formatJalaliDate(o.createdAt)} ·{" "}
                          {formatTime(o.createdAt)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-md px-2 py-0.5 text-xs font-medium",
                          status.className,
                        )}
                      >
                        {status.label}
                      </span>
                    </div>

                    <ul className="flex flex-col gap-1 text-xs text-muted">
                      {o.items.map((i) => (
                        <li key={i.id} className="flex justify-between gap-3">
                          <span className="truncate">
                            {i.ticketTypeName} × {formatNumber(i.quantity)}
                          </span>
                          <span className="tabular-nums">
                            {formatToman(i.unitPrice * i.quantity)}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                      <span className="text-sm font-bold text-foreground">
                        {formatToman(o.total)}
                      </span>

                      <div className="flex items-center gap-3">
                        <Link
                          href={`/orders/${o.code}`}
                          className="text-xs font-medium text-accent-text underline-offset-4 hover:underline"
                        >
                          جزئیات
                        </Link>
                        {open ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={cancelling === o.id}
                            onClick={() => cancel(o.id)}
                          >
                            <XCircle aria-hidden />
                            {cancelling === o.id ? "در حال لغو…" : "لغو سفارش"}
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {expiresSoon ? (
                      // The hold is what actually lapses; saying so is kinder
                      // than letting the order quietly expire.
                      <p className="flex items-center gap-1.5 text-[11px] text-warning-text">
                        <Clock className="size-3" aria-hidden />
                        تا {formatTime(o.expiresAt)} فرصت پرداخت دارید.
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
