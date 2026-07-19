import Link from "next/link";
import { BadgeCheck, ArrowLeft } from "lucide-react";

import { listWorkspaces, listEventsByWorkspace } from "@/lib/server";
import { formatNumber } from "@/lib/format";
import { FollowChip } from "@/components/workspace/FollowChip";

/**
 * Landing social strip: organizer/person pages to follow, reinforcing the
 * "follow pages and see their events" core of the platform.
 */
export function FollowPages() {
  const workspaces = listWorkspaces();
  if (workspaces.length === 0) return null;

  return (
    <section className="border-t border-border bg-subtle">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              صفحه‌ها را دنبال کنید
            </h2>
            <p className="mt-2 text-sm text-muted">
              افراد و کسب‌وکارها را دنبال کنید تا رویدادهایشان را در خوراک خود
              ببینید.
            </p>
          </div>
          <Link
            href="/pages"
            className="hidden shrink-0 items-center gap-1.5 text-sm font-medium text-muted underline-offset-4 hover:text-foreground hover:underline sm:inline-flex"
          >
            همهٔ برگزارکنندگان
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((w) => (
            <div
              key={w.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
            >
              <Link
                href={`/w/${w.slug}`}
                className="flex min-w-0 items-center gap-3"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-foreground text-base font-bold text-background">
                  {w.avatar}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-sm font-semibold text-foreground">
                    <span className="truncate">{w.name}</span>
                    {w.verified ? (
                      <BadgeCheck
                        className="size-3.5 shrink-0 text-accent"
                        aria-label="تأییدشده"
                      />
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {formatNumber(w.followers)} دنبال‌کننده ·{" "}
                    {formatNumber(listEventsByWorkspace(w.slug).length)} رویداد
                  </span>
                </span>
              </Link>
              <FollowChip slug={w.slug} name={w.name} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
