"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, Check, ChevronLeft, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Workspace } from "@/types";

// Shared with WorkspaceSwitcher so the active workspace stays in sync app-wide.
const STORAGE_KEY = "poster-active-workspace";

const typeLabel = (w: Workspace) =>
  w.type === "business" ? "کسب‌وکار" : "شخصی";

/**
 * Profile card: the active workspace's logo + name (tap to view/edit the
 * profile) with a control to switch between workspaces.
 */
export function ProfileCard({ workspaces }: { workspaces: Workspace[] }) {
  const [activeId, setActiveId] = useState(workspaces[0]?.id ?? "");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && workspaces.some((w) => w.id === saved)) setActiveId(saved);
  }, [workspaces]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0];
  if (!active) return null;

  function select(id: string) {
    setActiveId(id);
    localStorage.setItem(STORAGE_KEY, id);
    setOpen(false);
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Tap the identity to open the editable profile. */}
      <Link
        href="/dashboard/profile/edit"
        className="flex items-center gap-4 rounded-t-lg p-5 outline-none transition-colors hover:bg-subtle focus-visible:bg-subtle"
      >
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-foreground text-lg font-bold text-background">
          {active.avatar}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-foreground">
            {active.name}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {typeLabel(active)} · مشاهده و ویرایش پروفایل
          </p>
        </div>
        <ChevronLeft className="size-5 shrink-0 text-faint" aria-hidden />
      </Link>

      {/* Switch workspace */}
      <div ref={ref} className="relative border-t border-border p-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-subtle px-3 py-2.5 text-start outline-none transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <ArrowLeftRight className="size-4 shrink-0 text-muted" aria-hidden />
          <span className="flex-1 text-sm font-medium text-foreground">
            تغییر فضای کاری
          </span>
          <span className="text-xs text-faint">{active.avatar}</span>
        </button>

        {open ? (
          <div
            role="menu"
            className="absolute inset-x-3 top-full z-50 mt-1 rounded-lg border border-border bg-background p-1 shadow-lg shadow-foreground/5"
          >
            <p className="px-2 py-1.5 text-xs text-faint">فضاهای کاری</p>
            {workspaces.map((w) => (
              <button
                key={w.id}
                type="button"
                role="menuitemradio"
                aria-checked={w.id === active.id}
                onClick={() => select(w.id)}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-start outline-none transition-colors hover:bg-subtle focus-visible:bg-subtle"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-foreground text-xs font-bold text-background">
                  {w.avatar}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">
                    {w.name}
                  </span>
                  <span className="block text-xs text-muted">{typeLabel(w)}</span>
                </span>
                {w.id === active.id ? (
                  <Check className="size-4 shrink-0 text-foreground" aria-hidden />
                ) : null}
              </button>
            ))}

            <div className="my-1 h-px bg-border" />

            <Link
              href="/dashboard/workspaces/new"
              role="menuitem"
              className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm text-foreground outline-none transition-colors hover:bg-subtle focus-visible:bg-subtle"
            >
              <Plus className="size-4" aria-hidden />
              ساخت فضای کاری جدید
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
