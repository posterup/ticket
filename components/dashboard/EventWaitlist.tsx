"use client";

/**
 * The waitlist queue, for the organiser.
 *
 * The endpoint behind this existed with nothing rendering it: an organiser
 * could switch the waitlist on, watch people join, and never see who was
 * waiting or how many tickets they wanted.
 *
 * Read-only on purpose. The platform messages the front of the queue
 * automatically whenever inventory is released, so there is no "notify" button
 * to press — offering one would imply a manual step that does not exist, and
 * invite double-messaging.
 */

import { useMemo } from "react";
import { BellRing, Clock, ListOrdered } from "lucide-react";

import { useApi } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { formatJalaliDate, formatNumber, formatTime } from "@/lib/format";
import { AsyncState } from "@/components/ui/async-state";

interface Entry {
  id: string;
  name: string;
  phone: string;
  quantity: number;
  position: number;
  notifiedAt?: string;
  createdAt: string;
}

export function EventWaitlist({ eventId }: { eventId: string }) {
  const { data, error, loading, reload } = useApi<Entry[]>(
    `/api/events/${eventId}/waitlist`,
  );

  const demand = useMemo(
    () => (data ?? []).reduce((sum, e) => sum + e.quantity, 0),
    [data],
  );

  if (!data) {
    return <AsyncState loading={loading} error={error} onRetry={reload} variant="table" rows={4} />;
  }

  if (!data.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <ListOrdered className="mx-auto mb-2 size-6 text-faint" aria-hidden />
        <p className="text-sm text-muted">هنوز کسی در لیست انتظار نیست.</p>
        <p className="mt-1 text-xs text-faint">
          وقتی بلیت‌ها تمام شود، خریداران می‌توانند در صف بنشینند.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-foreground">لیست انتظار</h3>
        <p className="text-xs text-muted">
          {formatNumber(data.length)} نفر · {formatNumber(demand)} بلیت
          درخواستی
        </p>
      </div>

      <p className="rounded-lg bg-subtle px-3 py-2 text-[11px] leading-relaxed text-muted">
        هر وقت ظرفیتی آزاد شود — لغو سفارش، پرداخت ناموفق یا پایان مهلت — به
        ترتیب نوبت پیامک می‌رود. جای صف رزرو بلیت نیست؛ هرکس زودتر بخرد بلیت را
        می‌گیرد.
      </p>

      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {data.map((e) => (
          <li key={e.id} className="flex items-center gap-3 px-4 py-3">
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums",
                e.position <= 3
                  ? "bg-accent-soft text-accent-text"
                  : "bg-subtle text-muted",
              )}
              aria-label={`نوبت ${e.position}`}
            >
              {formatNumber(e.position)}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {e.name}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <span dir="ltr">{e.phone}</span>
                <span aria-hidden>·</span>
                {formatNumber(e.quantity)} بلیت
              </p>
            </div>

            {e.notifiedAt ? (
              <span
                className="flex shrink-0 items-center gap-1 rounded-md bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success-text"
                title={`${formatJalaliDate(e.notifiedAt)} ${formatTime(e.notifiedAt)}`}
              >
                <BellRing className="size-3" aria-hidden />
                خبر داده شد
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1 text-[11px] text-faint">
                <Clock className="size-3" aria-hidden />
                در انتظار
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
