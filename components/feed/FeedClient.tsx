"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, MapPin, BadgeCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { getFollowedSlugs } from "@/lib/follow";
import { FollowChip } from "@/components/workspace/FollowChip";

export interface FeedEvent {
  id: string;
  title: string;
  modeLabel: string;
  venue: string;
  dateLabel: string;
  price: string | null;
  wsSlug: string;
  wsName: string;
  wsAvatar: string;
  wsVerified: boolean;
}

export interface FeedWorkspace {
  slug: string;
  name: string;
  avatar: string;
  type: "personal" | "business";
}

export function FeedClient({
  events,
  workspaces,
}: {
  events: FeedEvent[];
  workspaces: FeedWorkspace[];
}) {
  // null until localStorage is read on the client (avoids hydration mismatch).
  const [followed, setFollowed] = useState<string[] | null>(null);
  useEffect(() => {
    setFollowed(getFollowedSlugs());
  }, []);

  if (followed === null) {
    return <p className="text-sm text-muted">در حال بارگذاری…</p>;
  }

  const myEvents = events.filter((e) => followed.includes(e.wsSlug));

  if (myEvents.length === 0) {
    return <EmptyState workspaces={workspaces} following={followed.length > 0} />;
  }

  return (
    <ul className="flex flex-col gap-4">
      {myEvents.map((e) => (
        <li
          key={e.id}
          className="rounded-lg border border-border bg-card p-5"
        >
          <div className="flex items-center gap-2.5">
            <Link
              href={`/w/${e.wsSlug}`}
              className="flex items-center gap-2 text-sm font-medium text-foreground hover:underline"
            >
              <span className="grid size-8 place-items-center rounded-full bg-foreground text-xs font-bold text-background">
                {e.wsAvatar}
              </span>
              <span className="flex items-center gap-1">
                {e.wsName}
                {e.wsVerified ? (
                  <BadgeCheck className="size-4 text-accent" aria-label="تأییدشده" />
                ) : null}
              </span>
            </Link>
          </div>

          <Link href={`/events/${e.id}`} className="mt-4 block">
            <span className="text-xs text-faint">{e.modeLabel}</span>
            <h2 className="mt-1 text-base font-semibold text-foreground hover:underline">
              {e.title}
            </h2>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted">
              {e.dateLabel ? (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-4 text-faint" aria-hidden />
                  {e.dateLabel}
                </span>
              ) : null}
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4 text-faint" aria-hidden />
                {e.venue}
              </span>
            </div>
          </Link>

          {e.price ? (
            <p className="mt-4 border-t border-border pt-3 text-sm font-medium text-foreground">
              {e.price}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function EmptyState({
  workspaces,
  following,
}: {
  workspaces: FeedWorkspace[];
  following: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-sm font-medium text-foreground">
          {following
            ? "صفحه‌هایی که دنبال می‌کنید هنوز رویدادی ندارند."
            : "هنوز صفحه‌ای را دنبال نکرده‌اید."}
        </p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
          صفحه‌های برگزارکنندگان را دنبال کنید تا رویدادهایشان اینجا نمایش داده
          شود.
        </p>
        <Link
          href="/pages"
          className="mt-4 inline-block text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          مشاهدهٔ همهٔ برگزارکنندگان
        </Link>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">پیشنهاد برای دنبال کردن</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {workspaces.map((w) => (
            <div
              key={w.slug}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4",
              )}
            >
              <Link
                href={`/w/${w.slug}`}
                className="flex min-w-0 items-center gap-2.5"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-sm font-bold text-background">
                  {w.avatar}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {w.name}
                  </span>
                  <span className="block text-xs text-muted">
                    {w.type === "business" ? "کسب‌وکار" : "شخصی"}
                  </span>
                </span>
              </Link>
              <FollowChip slug={w.slug} name={w.name} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
