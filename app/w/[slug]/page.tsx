import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, CalendarDays, MapPin } from "lucide-react";

import {
  getWorkspaceBySlug,
  listEventsByWorkspace,
  listTickets,
} from "@/lib/server";
import { formatJalaliDate, formatToman } from "@/lib/format";
import { MODE_LABELS } from "@/lib/events/labels";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import { WorkspaceFollow } from "@/components/workspace/WorkspaceFollow";
import { EventCover } from "@/components/events/EventCover";

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const workspace = getWorkspaceBySlug(slug);
  return { title: workspace ? `${workspace.name} | پوستر` : "فضای کاری | پوستر" };
}

function fromPrice(eventId: string): string | null {
  const prices = listTickets(eventId).map((t) => t.price);
  if (prices.length === 0) return null;
  const min = Math.min(...prices);
  return min === 0 ? "رایگان" : `از ${formatToman(min)}`;
}

export default async function WorkspacePage({ params }: Params) {
  const { slug } = await params;
  const workspace = getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  const events = listEventsByWorkspace(slug);
  const typeLabel = workspace.type === "business" ? "کسب‌وکار" : "شخصی";

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-full bg-foreground text-xl font-bold text-background">
              {workspace.avatar}
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl font-bold text-foreground sm:text-2xl">
                  {workspace.name}
                </h1>
                {workspace.verified ? (
                  <BadgeCheck
                    className="size-5 text-accent"
                    aria-label="تأییدشده"
                  />
                ) : null}
              </div>
              <span className="mt-1 inline-flex rounded-full border border-border bg-subtle px-2.5 py-0.5 text-xs text-muted">
                {typeLabel}
              </span>
            </div>
          </div>

          {workspace.bio ? (
            <p className="max-w-2xl text-sm leading-relaxed text-muted">
              {workspace.bio}
            </p>
          ) : null}

          <WorkspaceFollow
            slug={workspace.slug}
            followers={workspace.followers}
            following={workspace.following}
          />
        </div>

        <section className="mt-10">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            رویدادها
          </h2>
          {events.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
              هنوز رویدادی منتشر نشده است.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {events.map((event) => {
                const price = fromPrice(event.id);
                const first = event.sessions[0];
                return (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-border-strong"
                  >
                    <EventCover
                      seed={event.id}
                      tags={event.tags}
                      className="aspect-video"
                    />
                    <div className="flex flex-1 flex-col p-5">
                      <span className="text-xs text-faint">
                        {MODE_LABELS[event.mode]}
                      </span>
                      <h3 className="mt-1 text-base font-semibold text-foreground">
                        {event.title}
                      </h3>
                      <div className="mt-4 flex flex-col gap-2 text-sm text-muted">
                        {first ? (
                          <span className="flex items-center gap-2">
                            <CalendarDays
                              className="size-4 text-faint"
                              aria-hidden
                            />
                            {formatJalaliDate(first.startAt)}
                          </span>
                        ) : null}
                        <span className="flex items-center gap-2">
                          <MapPin className="size-4 text-faint" aria-hidden />
                          {event.venue.name}، {event.venue.city}
                        </span>
                      </div>
                      {price ? (
                        <span className="mt-auto border-t border-border pt-3 text-sm font-medium text-foreground">
                          {price}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
