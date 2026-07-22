"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
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

/** Luma-calendar-style event list with Upcoming/Past tabs, grouped by month. */
export function WorkspaceEvents({ events }: { events: WsEvent[] }) {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const now = Date.now();

  const { upcoming, past } = useMemo(() => {
    const up: WsEvent[] = [];
    const pa: WsEvent[] = [];
    for (const e of events) {
      const t = new Date(e.start).getTime();
      (Number.isFinite(t) && t >= now ? up : pa).push(e);
    }
    up.sort((a, b) => a.start.localeCompare(b.start));
    pa.sort((a, b) => b.start.localeCompare(a.start));
    return { upcoming: up, past: pa };
  }, [events, now]);

  const list = tab === "upcoming" ? upcoming : past;

  const groups = useMemo(() => {
    const g: { label: string; items: WsEvent[] }[] = [];
    for (const e of list) {
      const label = monthLabel(e.start);
      let grp = g.find((x) => x.label === label);
      if (!grp) {
        grp = { label, items: [] };
        g.push(grp);
      }
      grp.items.push(e);
    }
    return g;
  }, [list]);

  return (
    <div className="flex flex-col gap-6">
      {/* Upcoming / Past tabs */}
      <div className="flex w-fit gap-1 rounded-full border border-border bg-card p-1">
        <TabButton active={tab === "upcoming"} onClick={() => setTab("upcoming")}>
          به‌زودی ({formatNumber(upcoming.length)})
        </TabButton>
        <TabButton active={tab === "past"} onClick={() => setTab("past")}>
          گذشته ({formatNumber(past.length)})
        </TabButton>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted">
          {tab === "upcoming"
            ? "رویداد پیش‌رویی وجود ندارد."
            : "رویداد گذشته‌ای وجود ندارد."}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-muted">{group.label}</h3>
            <ul className="flex flex-col gap-3">
              {group.items.map((e) => (
                <EventRow key={e.id} e={e} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
        active ? "bg-foreground text-background" : "text-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function EventRow({ e }: { e: WsEvent }) {
  return (
    <li>
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
          {e.price ? (
            <span className="mt-0.5 text-sm font-medium text-foreground">
              {e.price}
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
