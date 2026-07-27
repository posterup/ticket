"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

export interface ConsoleTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

/**
 * Tabbed container for the event management console. Each tab's content is
 * server-rendered and passed in; switching only toggles visibility so per-tab
 * client state (forms, check-in progress) survives navigation between tabs.
 *
 * Kept as a bespoke ARIA tablist (not HeroUI Tabs): it must keep every panel
 * mounted and simply hidden, which is exactly this markup.
 */
export function EventConsole({ tabs }: { tabs: ConsoleTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label="مدیریت رویداد"
        className="flex overflow-x-auto border-b border-border [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setActive(t.id)}
            className={cn(
              "-mb-px flex-1 shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-center text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30 sm:flex-none",
              active === t.id
                ? "border-accent font-semibold text-foreground"
                : "border-transparent font-medium text-muted hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={active !== t.id}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
