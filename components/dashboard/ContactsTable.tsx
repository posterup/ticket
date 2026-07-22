"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { ContactSheet } from "@/components/dashboard/ContactSheet";

export interface ContactEvent {
  id: string;
  title: string;
  dateLabel: string;
}

export interface Contact {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  tags: string[];
  events: ContactEvent[];
  /** Total Toman earned from this contact (mock, derived from joined events). */
  spent: number;
}

/** Smart contacts table: search, tag filter chips, and a per-contact sheet. */
export function ContactsTable({ contacts }: { contacts: Contact[] }) {
  const [rows, setRows] = useState<Contact[]>(contacts);
  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Distinct tags across all contacts, for the filter chips + suggestions.
  const allTags = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.tags.forEach((t) => set.add(t)));
    return [...set];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesQuery =
        q === "" ||
        r.fullName.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q);
      const matchesTags =
        activeTags.length === 0 || r.tags.some((t) => activeTags.includes(t));
      return matchesQuery && matchesTags;
    });
  }, [rows, query, activeTags]);

  function toggleTag(tag: string) {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function setTags(id: string, tags: string[]) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, tags } : r)));
  }

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const hasFilters = query !== "" || activeTags.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جست‌وجوی نام یا شماره تماس…"
          className="h-12 w-full rounded-md border border-border bg-card pe-10 ps-3.5 text-sm text-foreground outline-none transition-colors placeholder:text-faint hover:border-border-strong focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring/15"
        />
        <Search
          className="pointer-events-none absolute inset-y-0 end-3.5 my-auto size-4 text-faint"
          aria-hidden
        />
      </div>

      {/* Filter chips */}
      {allTags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {allTags.map((tag) => {
            const active = activeTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={active}
                onClick={() => toggleTag(tag)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-muted hover:border-border-strong hover:text-foreground",
                )}
              >
                {tag}
              </button>
            );
          })}
          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setActiveTags([]);
              }}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <X className="size-3.5" aria-hidden />
              پاک‌کردن
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-border bg-subtle px-5 py-2.5 text-xs font-medium text-muted">
          <span>نام و نام خانوادگی</span>
          <span>شماره تماس</span>
        </div>

        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">
            مخاطبی یافت نشد.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-5 py-3.5 text-start outline-none transition-colors hover:bg-subtle focus-visible:bg-subtle"
                >
                  <span className="truncate text-sm font-medium text-foreground">
                    {c.fullName}
                  </span>
                  <span className="text-sm text-muted" dir="ltr">
                    {c.phone}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ContactSheet
        contact={selected}
        allTags={allTags}
        onSetTags={setTags}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
