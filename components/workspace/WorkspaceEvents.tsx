"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";

import { EventCover } from "@/components/events/EventCover";

export interface WsEvent {
  id: string;
  title: string;
  /** Earliest session start (ISO) — used for upcoming/past + month grouping. */
  start: string;
  dateLabel: string;
  place: string;
  price: string | null;
  tags: string[];
}

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
  });
}

/** Luma-calendar-style event timeline, grouped by month (newest first). */
export function WorkspaceEvents({ events }: { events: WsEvent[] }) {
  const groups = useMemo(() => {
    const sorted = [...events].sort((a, b) => b.start.localeCompare(a.start));
    const g: { label: string; items: WsEvent[] }[] = [];
    for (const e of sorted) {
      const label = monthLabel(e.start);
      let grp = g.find((x) => x.label === label);
      if (!grp) {
        grp = { label, items: [] };
        g.push(grp);
      }
      grp.items.push(e);
    }
    return g;
  }, [events]);

  if (groups.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted">
        رویدادی وجود ندارد.
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      {groups.map((group) => (
        <section key={group.label} className="flex flex-col">
          {/* Month marker — rail passes through, no bullet */}
          <div className="flex gap-4">
            <Rail />
            <h3 className="py-2 text-sm font-semibold text-muted">
              {group.label}
            </h3>
          </div>
          {group.items.map((e) => (
            <div key={e.id} className="flex gap-4">
              <Rail bullet />
              <div className="min-w-0 flex-1 pb-4">
                <EventRow e={e} />
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

/** One cell of the timeline gutter: a continuous vertical line, optionally with an event node. */
function Rail({ bullet }: { bullet?: boolean }) {
  return (
    <div className="relative flex w-3 shrink-0 justify-center">
      <span className="absolute inset-y-0 w-px bg-border" aria-hidden />
      {bullet ? (
        <span
          className="relative mt-6 size-3 rounded-full bg-accent ring-4 ring-background"
          aria-hidden
        />
      ) : null}
    </div>
  );
}

function EventRow({ e }: { e: WsEvent }) {
  return (
    <Link
      href={`/events/${e.id}`}
      className="flex gap-4 overflow-hidden rounded-xl border border-border bg-card p-3 transition-colors hover:border-border-strong"
    >
        <EventCover
          seed={e.id}
          tags={e.tags}
          className="size-20 shrink-0 rounded-lg sm:size-24"
        />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <h4 className="truncate text-sm font-semibold text-foreground sm:text-base">
            {e.title}
          </h4>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <CalendarDays className="size-3.5 shrink-0 text-faint" aria-hidden />
            {e.dateLabel}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <MapPin className="size-3.5 shrink-0 text-faint" aria-hidden />
            <span className="truncate">{e.place}</span>
          </span>
        </div>
        {e.price ? (
          <div className="relative flex w-20 shrink-0 flex-col items-end justify-center border-s border-dashed border-border ps-3 text-end">
            {/* ticket perforation — notch cut-outs at the ends of the tear line */}
            <span
              className="absolute -top-3 start-0 -ms-1.5 size-3 -translate-y-1/2 rounded-full bg-background"
              aria-hidden
            />
            <span
              className="absolute -bottom-3 start-0 -ms-1.5 size-3 translate-y-1/2 rounded-full bg-background"
              aria-hidden
            />
            <span className="text-sm font-bold leading-tight text-accent sm:text-base">
              {e.price === "رایگان" ? "رایگان" : e.price.replace(" تومان", "")}
            </span>
            {e.price !== "رایگان" ? (
              <span className="text-[10px] text-muted">تومان</span>
            ) : null}
          </div>
        ) : null}
    </Link>
  );
}
