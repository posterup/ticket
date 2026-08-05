"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, Check, ChevronLeft, Plus } from "lucide-react";

import { useWorkspaceSwitcher } from "@/components/dashboard/ActiveWorkspace";
import { WorkspaceAvatar } from "@/components/workspace/WorkspaceAvatar";

/**
 * Profile card: the active workspace's logo + name (tap to view the public
 * profile as a visitor sees it) with a control to switch between workspaces.
 * Editing lives in its own menu entry (see {@link AccountMenu}).
 *
 * The choice comes from {@link useWorkspaceSwitcher}, the same cookie-backed
 * context the shell's switcher uses. This card kept its own `localStorage` copy
 * after the switcher moved off it, so the two could disagree — and then the
 * edit form, which read the same stale key, would edit a workspace the rest of
 * the dashboard was not showing.
 */
export function ProfileCard() {
  const { workspaces, active, select } = useWorkspaceSwitcher();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  if (!active) return null;

  function choose(id: string) {
    select(id);
    setOpen(false);
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Tap the identity to view the public profile as a visitor sees it —
          same tab, not a new one. Editing has its own menu entry. */}
      <Link
        href={`/w/${active.slug}`}
        className="flex items-center gap-4 rounded-t-lg p-5 outline-none transition-colors hover:bg-subtle focus-visible:bg-subtle"
      >
        <WorkspaceAvatar src={active.avatar} className="size-14 rounded-full" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-foreground">
            {active.name}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            مشاهده پروفایل
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
          className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-subtle px-3 py-2.5 text-start outline-none transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeftRight className="size-4 shrink-0 text-muted" aria-hidden />
          <span className="flex-1 text-sm font-medium text-foreground">
            تغییر فضای کاری
          </span>
          <span className="truncate text-xs text-faint">{active.name}</span>
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
                onClick={() => choose(w.id)}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-start outline-none transition-colors hover:bg-subtle focus-visible:bg-subtle"
              >
                <WorkspaceAvatar src={w.avatar} className="size-7 rounded-md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">
                    {w.name}
                  </span>
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
