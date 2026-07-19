"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, CalendarDays, Search, X, BadgeCheck, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/format";

export interface DiscoverEvent {
  id: string;
  title: string;
  modeLabel: string;
  city: string;
  venueName: string;
  dateLabel: string;
  sortKey: string;
  price: string | null;
  going: number;
  tags: string[];
  org: { slug: string; name: string; avatar: string; verified: boolean } | null;
}

/** How many category chips to surface (most frequent tags first). */
const MAX_CATEGORIES = 8;

export function EventsExplorer({ events }: { events: DiscoverEvent[] }) {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  const cities = useMemo(() => {
    return [...new Set(events.map((e) => e.city))].sort((a, b) =>
      a.localeCompare(b, "fa"),
    );
  }, [events]);

  const categories = useMemo(() => {
    const freq = new Map<string, number>();
    for (const e of events) {
      for (const t of e.tags) freq.set(t, (freq.get(t) ?? 0) + 1);
    }
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_CATEGORIES)
      .map(([tag]) => tag);
  }, [events]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (city && e.city !== city) return false;
      if (category && !e.tags.includes(category)) return false;
      if (q) {
        const haystack = [e.title, e.venueName, e.city, e.org?.name ?? "", ...e.tags]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [events, query, city, category]);

  const hasFilters = Boolean(query || city || category);

  return (
    <div className="flex flex-col gap-6">
      {/* Search */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute inset-y-0 end-3.5 my-auto size-4 text-faint"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جست‌وجوی رویداد، برگزارکننده یا مکان…"
          aria-label="جست‌وجوی رویداد"
          className="pe-10"
        />
      </div>

      {/* City filter */}
      <FilterRow label="شهر">
        <Chip active={city === null} onClick={() => setCity(null)}>
          همه شهرها
        </Chip>
        {cities.map((c) => (
          <Chip key={c} active={city === c} onClick={() => setCity(c === city ? null : c)}>
            {c}
          </Chip>
        ))}
      </FilterRow>

      {/* Category filter */}
      {categories.length > 0 ? (
        <FilterRow label="دسته">
          <Chip active={category === null} onClick={() => setCategory(null)}>
            همه
          </Chip>
          {categories.map((t) => (
            <Chip
              key={t}
              active={category === t}
              onClick={() => setCategory(t === category ? null : t)}
            >
              {t}
            </Chip>
          ))}
        </FilterRow>
      ) : null}

      {/* Result meta */}
      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-sm text-muted">
          {formatNumber(filtered.length)} رویداد
        </p>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCity(null);
              setCategory(null);
            }}
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
            حذف فیلترها
          </button>
        ) : null}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-sm font-medium text-foreground">رویدادی یافت نشد.</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            عبارت جست‌وجو یا فیلترها را تغییر دهید.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <Link
              key={e.id}
              href={`/events/${e.id}`}
              className="flex flex-col rounded-lg border border-border bg-card p-5 transition-colors hover:border-border-strong"
            >
              {e.org ? (
                <span className="mb-3 flex items-center gap-2 text-xs text-muted">
                  <span className="grid size-6 place-items-center rounded-full bg-foreground text-[0.625rem] font-bold text-background">
                    {e.org.avatar}
                  </span>
                  <span className="flex items-center gap-1 truncate">
                    {e.org.name}
                    {e.org.verified ? (
                      <BadgeCheck className="size-3.5 shrink-0 text-accent" aria-label="تأییدشده" />
                    ) : null}
                  </span>
                </span>
              ) : null}
              <span className="text-xs text-faint">{e.modeLabel}</span>
              <h2 className="mt-1 text-base font-semibold text-foreground">{e.title}</h2>
              <div className="mt-4 flex flex-col gap-2 text-sm text-muted">
                {e.dateLabel ? (
                  <span className="flex items-center gap-2">
                    <CalendarDays className="size-4 text-faint" aria-hidden />
                    {e.dateLabel}
                  </span>
                ) : null}
                <span className="flex items-center gap-2">
                  <MapPin className="size-4 text-faint" aria-hidden />
                  {e.venueName}، {e.city}
                </span>
                {e.going > 0 ? (
                  <span className="flex items-center gap-2">
                    <Users className="size-4 text-faint" aria-hidden />
                    {formatNumber(e.going)} نفر می‌روند
                  </span>
                ) : null}
              </div>
              {e.price ? (
                <span className="mt-4 border-t border-border pt-3 text-sm font-medium text-foreground">
                  {e.price}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1.5 shrink-0 text-xs font-medium text-faint">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({
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
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/15",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted hover:border-border-strong hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
