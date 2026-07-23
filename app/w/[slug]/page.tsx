import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck } from "lucide-react";

import {
  getWorkspaceBySlug,
  listEventsByWorkspace,
  listTickets,
} from "@/lib/server";
import { formatJalaliDate, formatToman } from "@/lib/format";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import { WorkspaceFollow } from "@/components/workspace/WorkspaceFollow";
import { WorkspaceBanner } from "@/components/workspace/WorkspaceBanner";
import {
  WorkspaceEvents,
  type WsEvent,
} from "@/components/workspace/WorkspaceEvents";

function fromPrice(eventId: string): string | null {
  const prices = listTickets(eventId).map((t) => t.price);
  if (prices.length === 0) return null;
  const min = Math.min(...prices);
  return min === 0 ? "رایگان" : formatToman(min);
}

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const workspace = getWorkspaceBySlug(slug);
  return { title: workspace ? `${workspace.name} | پوستر` : "فضای کاری | پوستر" };
}

export default async function WorkspacePage({ params }: Params) {
  const { slug } = await params;
  const workspace = getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const events: WsEvent[] = listEventsByWorkspace(slug).map((e) => {
    const start =
      e.sessions.map((s) => s.startAt).sort()[0] ?? e.createdAt;
    return {
      id: e.id,
      title: e.title,
      start,
      dateLabel: formatJalaliDate(start),
      place: e.venue.onlineUrl
        ? "آنلاین"
        : [e.venue.name, e.venue.city].filter(Boolean).join("، "),
      price: fromPrice(e.id),
      tags: e.tags,
    };
  });

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {/* Banner + profile header (LinkedIn-style) */}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <WorkspaceBanner
            seed={workspace.slug}
            banner={workspace.banner}
            className="h-36 w-full sm:h-52"
          />
          <div className="px-5 pb-6 sm:px-6">
            <span className="-mt-12 grid size-24 place-items-center rounded-2xl bg-foreground text-3xl font-bold text-background ring-4 ring-card sm:-mt-14 sm:size-28">
              {workspace.avatar}
            </span>

            <div className="mt-3 flex items-center gap-1.5">
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">
                {workspace.name}
              </h1>
              {workspace.verified ? (
                <BadgeCheck className="size-5 text-accent" aria-label="تأییدشده" />
              ) : null}
            </div>
            {workspace.bio ? (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
                {workspace.bio}
              </p>
            ) : null}

            <div className="mt-4">
              <WorkspaceFollow slug={workspace.slug} />
            </div>
          </div>
        </div>

        {/* Events */}
        <section className="mt-8">
          <h2 className="mb-4 text-sm font-semibold text-foreground">رویدادها</h2>
          <WorkspaceEvents events={events} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
