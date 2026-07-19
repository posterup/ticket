"use client";

import {
  CalendarDays,
  MapPin,
  Globe,
  Link2,
  Lock,
  Ticket as TicketIcon,
  EyeOff,
} from "lucide-react";

import { formatJalaliDate, formatTime, formatToman, formatNumber } from "@/lib/format";
import { LOCATION_LABELS, VISIBILITY_LABELS } from "@/lib/create/labels";
import type { CreateDraft, SessionDraft, TicketTypeDraft } from "@/lib/create/types";

const VIS_ICON = { public: Globe, unlisted: Link2, private: Lock } as const;

function priceLabel(t: TicketTypeDraft): string {
  switch (t.kind) {
    case "free":
      return "رایگان";
    case "donation":
      return Number(t.minPrice) > 0 ? `از ${formatToman(Number(t.minPrice))}` : "کمک مالی";
    case "group":
      return `${formatToman(Number(t.price) || 0)} / ${formatNumber(Number(t.groupSize) || 0)} نفر`;
    default:
      return formatToman(Number(t.price) || 0);
  }
}

function timeRange(s: SessionDraft): string {
  if (!s.startTime) return "";
  const start = `1970-01-01T${s.startTime}:00.000Z`;
  const end = s.endTime ? `1970-01-01T${s.endTime}:00.000Z` : "";
  return end ? `${formatTime(start)} تا ${formatTime(end)}` : formatTime(start);
}

/** Live preview of the event as an attendee will see it. */
export function EventPreview({
  draft,
  sessions,
}: {
  draft: CreateDraft;
  sessions: SessionDraft[];
}) {
  const VisIcon = VIS_ICON[draft.visibility];
  const first = sessions[0];
  const locationText =
    draft.location.mode === "online"
      ? "رویداد آنلاین"
      : [draft.location.venueName, draft.location.city].filter(Boolean).join("، ");

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {draft.poster ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={draft.poster}
            alt="پوستر رویداد"
            className="aspect-video w-full object-cover"
          />
          {draft.gallery.length > 0 ? (
            <span className="absolute end-2 bottom-2 rounded-md bg-background/80 px-2 py-0.5 text-xs font-medium text-foreground backdrop-blur">
              +{formatNumber(draft.gallery.length)} رسانه
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-subtle px-5 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
          <VisIcon className="size-3.5" aria-hidden />
          {VISIBILITY_LABELS[draft.visibility]}
        </span>
        <span className="text-xs text-faint">{LOCATION_LABELS[draft.location.mode]}</span>
      </div>

      <div className="p-5">
        <span className="inline-flex rounded-full border border-border bg-subtle px-2.5 py-0.5 text-xs text-muted">
          {draft.category}
        </span>
        <h3 className="mt-3 text-lg font-bold text-foreground">
          {draft.title.trim() || "عنوان رویداد"}
        </h3>
        {draft.description.trim() ? (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
            {draft.description}
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 text-sm text-muted">
          <span className="flex items-center gap-2">
            <CalendarDays className="size-4 text-faint" aria-hidden />
            {first?.date ? (
              <>
                {formatJalaliDate(`${first.date}T00:00:00.000Z`)}
                {timeRange(first) ? ` · ${timeRange(first)}` : ""}
                {sessions.length > 1 ? ` · +${formatNumber(sessions.length - 1)} سانس دیگر` : ""}
              </>
            ) : (
              <span className="text-faint">تاریخ رویداد</span>
            )}
          </span>
          <span className="flex items-center gap-2">
            <MapPin className="size-4 text-faint" aria-hidden />
            {locationText || <span className="text-faint">مکان رویداد</span>}
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-2 border-t border-border pt-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-faint">
            <TicketIcon className="size-3.5" aria-hidden />
            بلیت‌ها
          </p>
          {draft.ticketTypes.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-1.5 text-foreground">
                {t.name.trim() || "بلیت بدون نام"}
                {t.hidden ? (
                  <EyeOff className="size-3.5 text-faint" aria-label="پنهان" />
                ) : null}
              </span>
              <span className="font-medium text-foreground">{priceLabel(t)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
