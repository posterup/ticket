"use client";

import { Tabs } from "@heroui/react";

import { cn } from "@/lib/utils";

export interface ConsoleTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

/**
 * Tabbed container for the event management console — HeroUI <Tabs> (React
 * Aria). Every panel is force-mounted (`shouldForceMount`) so per-tab client
 * state (forms, check-in progress) survives switching between tabs; only the
 * active panel is visible.
 */
export function EventConsole({ tabs }: { tabs: ConsoleTab[] }) {
  return (
    <Tabs
      aria-label="مدیریت رویداد"
      defaultSelectedKey={tabs[0]?.id}
      className="flex flex-col gap-6"
    >
      <Tabs.List className="flex overflow-x-auto border-b border-border [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => (
          <Tabs.Tab
            key={t.id}
            id={t.id}
            className={cn(
              "-mb-px flex-1 shrink-0 cursor-pointer whitespace-nowrap border-b-2 border-transparent px-4 py-3 text-center text-sm font-medium text-muted outline-none transition-colors hover:text-foreground sm:flex-none",
              "data-[selected]:border-accent data-[selected]:font-semibold data-[selected]:text-foreground",
              "data-[focus-visible]:ring-2 data-[focus-visible]:ring-inset data-[focus-visible]:ring-ring/30",
            )}
          >
            {t.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>

      {tabs.map((t) => (
        <Tabs.Panel key={t.id} id={t.id} shouldForceMount>
          {t.content}
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}
