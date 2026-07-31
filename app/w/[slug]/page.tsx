"use client";

import { use } from "react";
import { BadgeCheck } from "lucide-react";

import { useApi } from "@/lib/client/api";
import { AsyncState } from "@/components/ui/async-state";
import { formatJalaliDate } from "@/lib/format";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import { WorkspaceFollow } from "@/components/workspace/WorkspaceFollow";
import { WorkspaceBanner } from "@/components/workspace/WorkspaceBanner";
import {
  WorkspaceEvents,
  type WsEvent,
} from "@/components/workspace/WorkspaceEvents";
import type { Event, Workspace } from "@/types";

interface Data {
  workspace: Workspace;
  events: Event[];
  following: boolean;
  signedIn: boolean;
}

export default function WorkspacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { data, error, loading, reload } = useApi<Data>(
    `/api/workspaces/${slug}`,
  );

  if (!data) {
    return (
      <div className="flex min-h-[100dvh] flex-col">
        <PublicHeader />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
          <AsyncState loading={loading} error={error} onRetry={reload} variant="page" rows={1} />
        </main>
        <Footer />
      </div>
    );
  }

  const { workspace } = data;
  const events: WsEvent[] = data.events.map((e) => {
    const start = e.sessions.map((s) => s.startAt).sort()[0] ?? e.createdAt;
    return {
      id: e.id,
      title: e.title,
      start,
      dateLabel: formatJalaliDate(start),
      place: e.venue.onlineUrl
        ? "آنلاین"
        : [e.venue.name, e.venue.city].filter(Boolean).join("، "),
      tags: e.tags,
    };
  });

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-12 sm:px-6">
        <WorkspaceBanner
          seed={workspace.slug}
          banner={workspace.banner}
          className="h-36 w-full rounded-xl sm:h-52"
        />

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="flex items-center gap-1.5 text-2xl font-bold tracking-tight text-foreground">
              <span className="truncate">{workspace.name}</span>
              {workspace.verified ? (
                <BadgeCheck className="size-5 shrink-0 text-accent-text" aria-label="تأییدشده" />
              ) : null}
            </h1>
            {workspace.bio ? (
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
                {workspace.bio}
              </p>
            ) : null}
          </div>
          <div className="w-full shrink-0 sm:w-40">
            <WorkspaceFollow
              slug={workspace.slug}
              initialFollowing={data.following}
              signedIn={data.signedIn}
            />
          </div>
        </div>

        <div className="mt-10">
          <WorkspaceEvents events={events} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
