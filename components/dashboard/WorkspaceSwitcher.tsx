"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronsUpDown, Plus, ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Workspace } from "@/types";

const STORAGE_KEY = "poster-active-workspace";

/** Switch between the user's workspaces (personal / business pages). */
export function WorkspaceSwitcher({ workspaces }: { workspaces: Workspace[] }) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(workspaces[0]?.id ?? "");
  const ref = useRef<HTMLDivElement>(null);

  // Restore the last-selected workspace (persists across navigation).
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && workspaces.some((w) => w.id === saved)) setActiveId(saved);
  }, [workspaces]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  const typeLabel = (w: Workspace) =>
    w.type === "business" ? "کسب‌وکار" : "شخصی";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card p-2 text-start outline-none transition-colors hover:bg-subtle focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <Avatar workspace={active} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {active.name}
          </p>
          <p className="truncate text-xs text-muted">{typeLabel(active)}</p>
        </div>
        <ChevronsUpDown className="size-4 shrink-0 text-faint" aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute inset-x-0 top-full z-50 mt-1 rounded-lg border border-border bg-card p-1 shadow-lg shadow-foreground/5"
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
              <Avatar workspace={w} small />
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
            href={`/w/${active.slug}`}
            role="menuitem"
            className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm text-muted outline-none transition-colors hover:bg-subtle focus-visible:bg-subtle"
          >
            <ExternalLink className="size-4" aria-hidden />
            مشاهده صفحه عمومی
          </Link>
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
  );
}

function Avatar({
  workspace,
  small,
}: {
  workspace: Workspace;
  small?: boolean;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-md bg-foreground font-bold text-background",
        small ? "size-7 text-xs" : "size-8 text-sm",
      )}
    >
      {workspace.avatar}
    </span>
  );
}
