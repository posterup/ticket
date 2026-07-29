"use client";

import { use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

import { useApi } from "@/lib/client/api";
import { AsyncState } from "@/components/ui/async-state";
import { formatToman } from "@/lib/format";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import type { Order } from "@/types";

/**
 * Where the gateway returns the buyer.
 *
 * Reached by tracking code rather than id, so it can be shared and revisited
 * without a session — a guest checkout has no account to look it up under.
 */
export default function OrderResultPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const state = useSearchParams().get("state");
  const { data: order, error, loading, reload } = useApi<Order>(
    `/api/orders/by-code/${code}`,
  );

  if (!order) {
    return (
      <div className="flex min-h-[100dvh] flex-col">
        <PublicHeader />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-12 sm:px-6">
          <AsyncState loading={loading} error={error} onRetry={reload} />
        </main>
        <Footer />
      </div>
    );
  }

  const failed = state === "failed" || order.status === "failed";
  const paid = order.status === "paid";

  const tone = paid
    ? { Icon: CheckCircle2, className: "bg-success/10 text-success" }
    : failed
      ? { Icon: XCircle, className: "bg-danger/10 text-danger" }
      : { Icon: Clock, className: "bg-subtle text-muted" };
  const { Icon } = tone;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-12 sm:px-6">
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <span
            className={`mx-auto mb-5 grid size-14 place-items-center rounded-full ${tone.className}`}
          >
            <Icon className="size-8" aria-hidden />
          </span>
          <h1 className="text-xl font-bold text-foreground">
            {paid ? "پرداخت انجام شد" : failed ? "پرداخت انجام نشد" : "در انتظار پرداخت"}
          </h1>
          <p className="mt-2 text-sm text-muted">{`کد پیگیری: ${order.code}`}</p>

          <dl className="mt-6 flex flex-col gap-2 text-sm">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-4">
                <dt className="text-muted">
                  {item.ticketTypeName} × {item.quantity}
                </dt>
                <dd className="text-foreground">
                  {formatToman(item.unitPrice * item.quantity)}
                </dd>
              </div>
            ))}
            {order.discountAmount > 0 ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">تخفیف</dt>
                <dd className="text-success">{`− ${formatToman(order.discountAmount)}`}</dd>
              </div>
            ) : null}
            <div className="mt-1 flex justify-between gap-4 border-t border-border pt-2 font-semibold">
              <dt className="text-foreground">مبلغ</dt>
              <dd className="text-foreground">{formatToman(order.total)}</dd>
            </div>
          </dl>

          <div className="mt-7 flex flex-col gap-2">
            {paid ? (
              <Link
                href="/me"
                className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
              >
                مشاهدهٔ بلیت‌های من
              </Link>
            ) : null}
            <Link
              href={`/events/${order.eventId}`}
              className="text-sm font-medium text-muted underline-offset-4 hover:text-foreground hover:underline"
            >
              بازگشت به رویداد
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
