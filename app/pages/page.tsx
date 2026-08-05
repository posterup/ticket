"use client";

import Link from "next/link";
import { BadgeCheck } from "lucide-react";

import { useApi } from "@/lib/client/api";
import { AsyncState } from "@/components/ui/async-state";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import { FollowChip } from "@/components/workspace/FollowChip";
import type { Workspace } from "@/types";

export default function PagesDirectory() {
  const { data, error, loading, reload } = useApi<Workspace[]>("/api/workspaces");
  const me = useApi<{ user: unknown | null }>("/api/auth/me");
  const following = useApi<Workspace[]>(
    me.data?.user ? "/api/me/following" : null,
  );
  const followedSlugs = new Set((following.data ?? []).map((w) => w.slug));

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

        {data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((w) => (
              <WorkspaceCard
                key={w.id}
                workspace={w}
                following={followedSlugs.has(w.slug)}
                signedIn={Boolean(me.data?.user)}
              />
            ))}
          </div>
        ) : (
          <AsyncState loading={loading} error={error} onRetry={reload} variant="cards" rows={6} />
        )}
      </main>
      <Footer />
    </div>
  );
}

function WorkspaceCard({
  workspace: w,
  following,
  signedIn,
}: {
  workspace: Workspace;
  following: boolean;
  signedIn: boolean;
}) {
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
                className="size-4 shrink-0 text-accent-text"
                aria-label="تأییدشده"
              />
            ) : null}
          </Link>
        </div>
      </div>

      {w.bio ? (
        <p className="line-clamp-2 text-xs leading-relaxed text-muted">{w.bio}</p>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-3">
        <span className="text-xs text-muted">
          {formatNumber(w.followers)} دنبال‌کننده
        </span>
        <FollowChip
          slug={w.slug}
          name={w.name}
          initialFollowing={following}
          signedIn={signedIn}
        />
      </div>
    </div>
  );
}
