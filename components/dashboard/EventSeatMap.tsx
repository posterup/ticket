"use client";

/**
 * Adopt a seat map for a showing, and price it.
 *
 * Organisers do not design venues — our operations team publishes a layout per
 * venue and this is where an organiser picks it up. Until this existed the two
 * halves of the feature could only be joined by the seed script.
 *
 * Pricing is part of the same form on purpose: a section with no ticket type
 * refuses every purchase, so letting the map be attached without prices would
 * put a half-configured event on sale.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Armchair, Check } from "lucide-react";

import { apiFetch, ApiCallError, useApi } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import {
  formatJalaliDate,
  formatNumber,
  formatTime,
  formatToman,
} from "@/lib/format";
import { AsyncState } from "@/components/ui/async-state";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { EventSession, TicketType } from "@/types";

interface LayoutOption {
  versionId: string;
  version: number;
  venueName: string;
  totalSeats: number;
  sections: { key: string; name: string; kind: string; capacity: number }[];
}

interface Props {
  eventId: string;
  sessions: EventSession[];
  tickets: TicketType[];
}

const NONE = "";

export function EventSeatMap({ eventId, sessions, tickets }: Props) {
  const { data: options, error, loading, reload } = useApi<LayoutOption[]>(
    `/api/events/${eventId}/seatmap`,
  );

  const bookable = useMemo(
    () => sessions.filter((s) => !s.cancelled),
    [sessions],
  );
  const [sessionId, setSessionId] = useState(bookable[0]?.id ?? "");
  const [versionId, setVersionId] = useState<string>(NONE);
  const [pricing, setPricing] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const session = bookable.find((s) => s.id === sessionId);
  const chosen = options?.find((o) => o.versionId === versionId);

  // Reflect whatever this showing is already using.
  useEffect(() => {
    setVersionId(session?.layoutVersionId ?? NONE);
    setMessage(null);
  }, [session?.layoutVersionId, sessionId]);

  // Default every section to the dearest tier rather than leaving blanks —
  // an unpriced section is the one failure mode this form exists to prevent.
  useEffect(() => {
    if (!chosen) return;
    const dearest = [...tickets].sort((a, b) => b.price - a.price)[0];
    setPricing((prev) => {
      const next = { ...prev };
      for (const s of chosen.sections) {
        if (!next[s.key]) next[s.key] = dearest?.id ?? NONE;
      }
      return next;
    });
  }, [chosen, tickets]);

  const save = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await apiFetch<{ priced: number }>(
        `/api/events/${eventId}/seatmap`,
        {
          method: "PATCH",
          body: JSON.stringify({
            sessionId,
            layoutVersionId: versionId || null,
            ...(versionId && chosen
              ? {
                  pricing: chosen.sections
                    .filter((s) => pricing[s.key])
                    .map((s) => ({
                      sectionKey: s.key,
                      ticketTypeId: pricing[s.key],
                    })),
                }
              : {}),
          }),
        },
      );
      setMessage(
        versionId
          ? `نقشه وصل شد و ${formatNumber(result.priced)} بخش قیمت‌گذاری شد.`
          : "نقشه جدا شد؛ این سانس به فروش آزاد برگشت.",
      );
    } catch (e) {
      setMessage(e instanceof ApiCallError ? e.message : "ذخیره ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }, [eventId, sessionId, versionId, chosen, pricing]);

  if (!options) {
    return <AsyncState loading={loading} error={error} onRetry={reload} />;
  }

  if (!options.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <Armchair className="mx-auto mb-2 size-6 text-faint" aria-hidden />
        <p className="text-sm text-muted">
          برای این سالن هنوز نقشه‌ای منتشر نشده است.
        </p>
        <p className="mt-1 text-xs text-faint">
          نقشه سالن‌ها را تیم پوستر طراحی می‌کند؛ با پشتیبانی تماس بگیرید.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
      <div>
        <h3 className="text-sm font-bold text-foreground">نقشه صندلی</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          با وصل کردن نقشه، خریداران به‌جای انتخاب تعداد، صندلی مشخص انتخاب
          می‌کنند.
        </p>
      </div>

      {bookable.length > 1 ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">سانس</span>
          <Select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
            {bookable.map((s) => (
              <option key={s.id} value={s.id}>
                {formatJalaliDate(s.startAt)} · {formatTime(s.startAt)}
              </option>
            ))}
          </Select>
        </label>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">نقشه</span>
        <Select value={versionId} onChange={(e) => setVersionId(e.target.value)}>
          <option value={NONE}>بدون نقشه (فروش آزاد)</option>
          {options.map((o) => (
            <option key={o.versionId} value={o.versionId}>
              {o.venueName} — نسخه {formatNumber(o.version)} ·{" "}
              {formatNumber(o.totalSeats)} صندلی
            </option>
          ))}
        </Select>
      </label>

      {chosen ? (
        <div className="border-t border-border pt-4">
          <h4 className="mb-1 text-xs font-bold text-muted">
            قیمت هر بخش
          </h4>
          <p className="mb-3 text-[11px] leading-relaxed text-faint">
            هر بخش باید به یک نوع بلیت وصل باشد؛ بخش بدون قیمت قابل خرید نیست.
          </p>
          <ul className="flex flex-col gap-2">
            {chosen.sections.map((s) => (
              <li key={s.key} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {s.name}
                  <span className="ms-1.5 text-xs text-faint">
                    {s.kind === "standing" ? "ایستاده" : "صندلی‌دار"} ·{" "}
                    {formatNumber(s.capacity)}
                  </span>
                </span>
                <Select
                  aria-label={`نوع بلیت برای ${s.name}`}
                  className="h-10 w-44"
                  value={pricing[s.key] ?? NONE}
                  onChange={(e) =>
                    setPricing((p) => ({ ...p, [s.key]: e.target.value }))
                  }
                >
                  <option value={NONE}>— انتخاب کنید</option>
                  {tickets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {formatToman(t.price)}
                    </option>
                  ))}
                </Select>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {message ? (
        <p
          role="status"
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs",
            message.includes("ناموفق") || message.includes("نمی")
              ? "bg-danger/10 text-danger-text"
              : "bg-success/10 text-success-text",
          )}
        >
          <Check className="size-3.5" aria-hidden />
          {message}
        </p>
      ) : null}

      <Button
        onClick={save}
        disabled={busy || !sessionId}
        size="sm"
        className="self-start"
      >
        {busy ? "در حال ذخیره…" : "ذخیره نقشه"}
      </Button>
    </div>
  );
}
