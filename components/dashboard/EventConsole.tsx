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
 */
export function EventConsole({ tabs }: { tabs: ConsoleTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label="مدیریت رویداد"
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setActive(t.id)}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/30",
              active === t.id
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground",
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
