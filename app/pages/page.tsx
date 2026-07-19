import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";

import { listWorkspaces, listEventsByWorkspace } from "@/lib/server";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import { FollowChip } from "@/components/workspace/FollowChip";
import type { Workspace } from "@/types";

export const metadata: Metadata = {
  title: "برگزارکنندگان | پوستر",
  description: "صفحه‌های برگزارکنندگان و کسب‌وکارها را دنبال کنید.",
};

export default function PagesDirectory() {
  const workspaces = listWorkspaces();

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            برگزارکنندگان
          </h1>
          <p className="mt-2 text-sm text-muted">
            صفحه‌های افراد و کسب‌وکارها را دنبال کنید تا رویدادهایشان را ببینید.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((w) => (
            <WorkspaceCard
              key={w.id}
              workspace={w}
              eventCount={listEventsByWorkspace(w.slug).length}
            />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function WorkspaceCard({
  workspace: w,
  eventCount,
}: {
  workspace: Workspace;
  eventCount: number;
}) {
  const typeLabel = w.type === "business" ? "کسب‌وکار" : "شخصی";
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-full bg-foreground text-base font-bold text-background",
          )}
        >
          {w.avatar}
        </span>
        <div className="min-w-0 flex-1">
          <Link
            href={`/w/${w.slug}`}
            className="flex items-center gap-1 text-sm font-semibold text-foreground underline-offset-4 hover:underline"
          >
            <span className="truncate">{w.name}</span>
            {w.verified ? (
              <BadgeCheck
                className="size-4 shrink-0 text-accent"
                aria-label="تأییدشده"
              />
            ) : null}
          </Link>
          <span className="mt-1 inline-flex rounded-full border border-border bg-subtle px-2 py-0.5 text-[0.6875rem] text-muted">
            {typeLabel}
          </span>
        </div>
      </div>

      {w.bio ? (
        <p className="line-clamp-2 text-xs leading-relaxed text-muted">
          {w.bio}
        </p>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-3">
        <span className="text-xs text-muted">
          {formatNumber(w.followers)} دنبال‌کننده · {formatNumber(eventCount)}{" "}
          رویداد
        </span>
        <FollowChip name={w.name} />
      </div>
    </div>
  );
}
