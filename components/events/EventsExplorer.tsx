"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MapPin, ChevronDown, Check, CalendarDays, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { cityDescription } from "@/lib/geo/iran";
import { EventCover } from "@/components/events/EventCover";

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
  categories: string[];
  org: { slug: string; name: string; avatar: string; verified: boolean } | null;
}

const ALL_CITIES = "همه شهرها";

/** Discovery categories, in display order. «رایگان» is derived from price. */
const CATEGORIES = [
  "خلق",
  "فرهنگی",
  "گردشگر",
  "مهارت",
  "هیجان",
  "بازی",
  "آشپزی",
  "گفتگو",
  "هنر",
  "رایگان",
] as const;

/** Whether an event belongs to a category. «رایگان» keys off the free price. */
function inCategory(e: DiscoverEvent, cat: string): boolean {
  return cat === "رایگان" ? e.price === "رایگان" : e.categories.includes(cat);
}

/** How many events a filtered grid reveals before "view more". */
const PAGE = 8;

export function EventsExplorer({
  events,
  defaultCity,
}: {
  events: DiscoverEvent[];
  defaultCity?: string;
}) {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState(defaultCity ?? ALL_CITIES);
  const [category, setCategory] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE);

  const cities = useMemo(
    () =>
      [...new Set(events.map((e) => e.city))].sort((a, b) =>
        a.localeCompare(b, "fa"),
      ),
    [events],
  );

  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (city !== ALL_CITIES && e.city !== city) return false;
      if (!q) return true;
      const hay = [e.title, e.venueName, e.city, e.org?.name ?? "", ...e.tags]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [events, query, city]);

  const featured = useMemo(
    () => [...scoped].sort((a, b) => b.going - a.going).slice(0, 3),
    [scoped],
  );

  // Which category chips actually have events under the current city/query.
  const activeCategories = useMemo(
    () => CATEGORIES.filter((c) => scoped.some((e) => inCategory(e, c))),
    [scoped],
  );

  // No filter → one carousel per non-empty category.
  const categoryRows = useMemo(
    () =>
      activeCategories.map((cat) => ({
        cat,
        events: scoped.filter((e) => inCategory(e, cat)),
      })),
    [activeCategories, scoped],
  );

  // A filter → the full list for that category.
  const filtered = useMemo(
    () => (category ? scoped.filter((e) => inCategory(e, category)) : []),
    [scoped, category],
  );

  // Reset pagination whenever the selection or the underlying set changes.
  useEffect(() => setVisible(PAGE), [category, city, query]);

  return (
    <div className="flex flex-col gap-8">
      {/* City header (name + chevron + description), then search below */}
      <div className="flex flex-col gap-4">
        <CityHeader
          cities={cities}
          city={city}
          onChange={setCity}
          description={cityDescription(city)}
        />
        <div className="relative">
          <Search
            className="pointer-events-none absolute inset-y-0 end-3.5 my-auto size-4 text-faint"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جست‌وجوی رویداد، برگزارکننده یا مکان…"
            aria-label="جست‌وجوی رویداد"
            className="h-12 w-full rounded-full border border-border bg-card pe-10 ps-4 text-sm text-foreground outline-none transition-colors placeholder:text-faint hover:border-border-strong focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring/15"
          />
        </div>
      </div>

      {scoped.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-sm font-medium text-foreground">رویدادی یافت نشد.</p>
          <p className="mt-1 text-sm text-muted">شهر یا عبارت دیگری را امتحان کنید.</p>
        </div>
      ) : (
        <>
          {/* Hero — only in the default (no-filter) view */}
          {category === null && featured.length > 0 ? (
            <Hero events={featured} />
          ) : null}

          {/* Category filter chips */}
          <FilterBar
            categories={activeCategories}
            selected={category}
            onSelect={setCategory}
          />

          {category === null ? (
            // No filter → a carousel per category
            categoryRows.map((row) => (
              <Carousel
                key={row.cat}
                title={row.cat}
                count={row.events.length}
                onViewMore={() => setCategory(row.cat)}
              >
                {row.events.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </Carousel>
            ))
          ) : (
            // A filter → a grid with "view more"
            <section className="flex flex-col gap-5">
              <div className="flex items-baseline gap-2">
                <h2 className="text-lg font-bold text-foreground">{category}</h2>
                <span className="text-xs text-muted">
                  {formatNumber(filtered.length)} رویداد
                </span>
              </div>

              {filtered.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted">
                  رویدادی در این دسته یافت نشد.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
                    {filtered.slice(0, visible).map((e) => (
                      <EventCard key={e.id} event={e} carousel={false} />
                    ))}
                  </div>
                  {visible < filtered.length ? (
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => setVisible((v) => v + PAGE)}
                        className="rounded-full border border-border bg-card px-6 py-2.5 text-sm font-medium text-foreground shadow-sm outline-none transition-colors hover:border-accent focus-visible:ring-2 focus-visible:ring-ring/40"
                      >
                        مشاهده بیشتر
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function FilterBar({
  categories,
  selected,
  onSelect,
}: {
  categories: readonly string[];
  selected: string | null;
  onSelect: (cat: string | null) => void;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      <Chip active={selected === null} onClick={() => onSelect(null)}>
        همه
      </Chip>
      {categories.map((c) => (
        <Chip key={c} active={selected === c} onClick={() => onSelect(c)}>
          {c}
        </Chip>
      ))}
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
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted hover:border-border-strong hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Hero({ events }: { events: DiscoverEvent[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    // RTL-safe: derive the slide from scroll progress, not sign of scrollLeft.
    const max = el.scrollWidth - el.clientWidth;
    const progress = max > 0 ? Math.abs(el.scrollLeft) / max : 0;
    setActive(Math.round(progress * (events.length - 1)));
  }

  function goTo(i: number) {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * i * (el.dir === "rtl" ? -1 : 1), behavior: "smooth" });
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={ref}
        onScroll={onScroll}
        className="-mx-4 flex snap-x snap-mandatory overflow-x-auto px-4 sm:mx-0 sm:px-0"
      >
        {events.map((e) => (
          <Link
            key={e.id}
            href={`/events/${e.id}`}
            className="relative w-full shrink-0 snap-center overflow-hidden rounded-2xl border border-border"
          >
            <EventCover seed={e.id} tags={e.tags} className="h-52 w-full sm:h-72" />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/75 via-foreground/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
              <h2 className="text-lg font-bold text-background sm:text-2xl">
                {e.title}
              </h2>
              <p className="mt-1 text-sm text-background/85">
                {[e.dateLabel, `${e.venueName}، ${e.city}`, e.price]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {events.length > 1 ? (
        <div className="flex justify-center gap-1.5">
          {events.map((e, i) => (
            <button
              key={e.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`اسلاید ${i + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === active ? "w-5 bg-foreground" : "w-1.5 bg-border-strong",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CityHeader({
  cities,
  city,
  onChange,
  description,
}: {
  cities: string[];
  city: string;
  onChange: (city: string) => void;
  description: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const options = [ALL_CITIES, ...cities];

  return (
    <div>
      <div ref={ref} className="relative inline-block">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex items-center gap-2 rounded-lg text-start outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <span className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {city}
          </span>
          <ChevronDown
            className={cn(
              "size-6 text-faint transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>

        {open ? (
          <ul
            role="listbox"
            className="absolute start-0 top-full z-50 mt-2 max-h-72 w-56 overflow-y-auto rounded-lg border border-border bg-background p-1 shadow-lg shadow-foreground/5"
          >
            {options.map((c) => (
              <li key={c}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c === city}
                  onClick={() => {
                    onChange(c);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-sm text-foreground outline-none transition-colors hover:bg-subtle focus-visible:bg-subtle"
                >
                  <MapPin className="size-4 shrink-0 text-faint" aria-hidden />
                  <span className="flex-1 truncate">{c}</span>
                  {c === city ? (
                    <Check className="size-4 shrink-0 text-foreground" aria-hidden />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <p className="mt-1 text-sm text-muted">{description}</p>
    </div>
  );
}

function Carousel({
  title,
  count,
  onViewMore,
  children,
}: {
  title: string;
  count: number;
  onViewMore?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        <span className="text-xs text-muted">{formatNumber(count)} رویداد</span>
        {onViewMore ? (
          <button
            type="button"
            onClick={onViewMore}
            className="ms-auto text-xs font-medium text-accent underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            مشاهده همه
          </button>
        ) : null}
      </div>
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto scroll-px-4 px-4 pb-1 sm:mx-0 sm:px-0">
        {children}
      </div>
    </section>
  );
}

function EventCard({
  event: e,
  rank,
  carousel = true,
}: {
  event: DiscoverEvent;
  rank?: number;
  carousel?: boolean;
}) {
  return (
    <Link
      href={`/events/${e.id}`}
      className={cn(
        "flex flex-col",
        carousel ? "w-64 shrink-0 snap-start sm:w-72" : "w-full",
      )}
    >
      <div className="relative">
        <EventCover
          seed={e.id}
          tags={e.tags}
          className="aspect-video rounded-xl border border-border"
        />
        {rank ? (
          <span className="absolute end-2 top-2 grid size-7 place-items-center rounded-full bg-background/85 text-sm font-bold text-foreground backdrop-blur">
            {formatNumber(rank)}
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-col gap-1">
        <h3 className="truncate text-sm font-semibold text-foreground">{e.title}</h3>
        {e.dateLabel ? (
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <CalendarDays className="size-3.5 shrink-0 text-faint" aria-hidden />
            {e.dateLabel}
          </span>
        ) : null}
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <MapPin className="size-3.5 shrink-0 text-faint" aria-hidden />
          <span className="truncate">
            {e.venueName}، {e.city}
          </span>
        </span>
        {e.price ? (
          <span className="mt-0.5 text-sm font-semibold text-foreground">
            {e.price}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
