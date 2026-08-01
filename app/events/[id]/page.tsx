"use client";

import { use } from "react";

import { useApi } from "@/lib/client/api";
import { AsyncState } from "@/components/ui/async-state";
import Link from "next/link";

import {
  Armchair,
  MapPin,
  Clock,
  ChevronLeft,
  BadgeCheck,
  Ticket,
  Video,
} from "lucide-react";

import { formatJalaliDate, formatTime } from "@/lib/format";
import { cityCoords } from "@/lib/geo/iran";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import { EventCover } from "@/components/events/EventCover";
import { NotifyMe } from "@/components/events/NotifyMe";
import { RequestToJoin } from "@/components/events/RequestToJoin";
import { JoinWaitlist } from "@/components/events/JoinWaitlist";
import { BuyBox } from "@/components/events/BuyBox";
import type {
  Event,
  EventCollaborator,
  TicketType,
  Workspace,
} from "@/types";
import { resolveBuyState } from "@/lib/events/buy-state";

interface Params {
  params: Promise<{ id: string }>;
}


interface PageData {
  event: Event;
  tickets: TicketType[];
  organizer: Workspace | null;
  collaborators: EventCollaborator[];
  signedIn: boolean;
  viewer?: { fullName: string; phone: string };
  viewerState: { bookmark: string | null; notify: boolean };
}

export default function PublicEventDetail({ params }: Params) {
  const { id } = use(params);
  // One request: the page needs all of it before it can show anything useful.
  const { data, error, loading, reload } = useApi<PageData>(
    `/api/events/${id}/page-data`,
  );

  if (!data) {
    return (
      <div className="flex min-h-[100dvh] flex-col">
        <PublicHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
          <AsyncState loading={loading} error={error} onRetry={reload} variant="page" rows={1} />
        </main>
        <Footer />
      </div>
    );
  }

  const { event, tickets, collaborators } = data;
  // The API returns null; the Hosts component treats absent as undefined.
  const organizer = data.organizer ?? undefined;
  const loggedIn = data.signedIn;
  const viewer = data.viewer;
  const viewerState = data.viewerState;

  const sessions = [...event.sessions].sort((a, b) =>
    a.startAt.localeCompare(b.startAt),
  );

  const online = Boolean(event.venue.onlineUrl);
  const pin =
    !online && !event.venue.hideAddress
      ? event.venue.lat != null && event.venue.lng != null
        ? { lat: event.venue.lat, lng: event.venue.lng }
        : cityCoords(event.venue.city)
      : null;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <Link
          href="/events"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ChevronLeft className="size-4 rotate-180" aria-hidden />
          همه رویدادها
        </Link>

        <div className="mt-4 grid gap-10 lg:grid-cols-[1fr_20rem] lg:items-start">
          {/* Main column */}
          <div className="flex min-w-0 flex-col gap-8">
            {/* 1. Poster */}
            <EventCover
              seed={event.id}
              poster={event.poster}
              tags={event.tags}
              className="aspect-[16/9] rounded-2xl"
            />

            {/* 1b. Title + meta */}
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {event.title}
              </h1>

              {/* organizer — attribution chip; a bordered pill with the
                  workspace avatar + a chevron reads clearly as tappable. */}
              {organizer ? (
                <Link
                  href={`/w/${organizer.slug}`}
                  aria-label={`صفحهٔ برگزارکننده: ${organizer.name}`}
                  className="group mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-card py-1 pe-2.5 ps-1 outline-none transition-colors hover:border-border-strong hover:bg-subtle focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-foreground text-[11px] font-bold text-background">
                    {organizer.avatar}
                  </span>
                  <span className="shrink-0 text-xs text-muted">برگزارکننده</span>
                  <span className="flex min-w-0 items-center gap-1 text-sm font-semibold text-foreground">
                    <span className="truncate">{organizer.name}</span>
                    {organizer.verified ? (
                      <BadgeCheck
                        className="size-4 shrink-0 text-accent-text"
                        aria-label="تأییدشده"
                      />
                    ) : null}
                  </span>
                  <ChevronLeft
                    className="size-4 shrink-0 text-faint transition-colors group-hover:text-muted"
                    aria-hidden
                  />
                </Link>
              ) : null}

              {/* location + sessions — plain icon + text rows, one per line,
                  stacked as tightly as possible. */}
              <div className="mt-3 flex flex-col gap-1">
                {/* location */}
                <p className="flex items-center gap-1.5 text-sm text-muted">
                  {online ? (
                    <Video className="size-4 shrink-0 text-faint" aria-hidden />
                  ) : (
                    <MapPin className="size-4 shrink-0 text-faint" aria-hidden />
                  )}
                  <span className="min-w-0 truncate">
                    {online
                      ? "رویداد آنلاین"
                      : [event.venue.name, event.venue.city]
                          .filter(Boolean)
                          .join("، ") || "مکان نامشخص"}
                  </span>
                </p>

                {/* sessions */}
                {sessions.map((s) => (
                  <p
                    key={s.id}
                    className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted"
                  >
                    <Clock className="size-4 shrink-0 text-faint" aria-hidden />
                    <span>
                      {formatJalaliDate(s.startAt)} · {formatTime(s.startAt)} تا{" "}
                      {formatTime(s.endAt)}
                    </span>
                    {s.cancelled ? (
                      <span className="rounded-md bg-subtle px-1.5 py-0.5 text-xs text-danger-text">
                        لغو شده
                      </span>
                    ) : s.layoutVersionId ? (
                      // Reserved seating changes what the buyer is about to be
                      // asked to do, so it is said up front rather than sprung
                      // on them at checkout.
                      <span className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent-text">
                        <Armchair className="size-3.5" aria-hidden />
                        صندلی شماره‌دار
                      </span>
                    ) : null}
                  </p>
                ))}
              </div>
            </div>

            {/* 3. Ticket buy card — mobile */}
            <BuyCard
              event={event}
              tickets={tickets}
              loggedIn={loggedIn}
              viewer={viewer}
              notified={viewerState.notify}
              className="lg:hidden"
            />

            {/* 4. Description */}
            {event.description ? (
              <section>
                <h2 className="mb-3 text-base font-semibold text-foreground">
                  درباره رویداد
                </h2>
                <p className="whitespace-pre-line text-base leading-8 text-foreground/80">
                  {event.description}
                </p>
              </section>
            ) : null}

            {/* 5. Location / map */}
            <Location event={event} online={online} pin={pin} />

            {/* 6. Hosts — mobile */}
            <Hosts
              organizer={organizer}
              collaborators={collaborators}
              className="lg:hidden"
            />
          </div>

          {/* Sidebar (desktop) */}
          <aside className="hidden lg:sticky lg:top-6 lg:flex lg:flex-col lg:gap-6">
            <BuyCard
              event={event}
              tickets={tickets}
              loggedIn={loggedIn}
              notified={viewerState.notify}
            />
            <Hosts organizer={organizer} collaborators={collaborators} />
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}


function BuyCard({
  event,
  tickets,
  loggedIn,
  viewer,
  notified,
  className,
}: {
  event: Event;
  tickets: TicketType[];
  /** Signed-in viewer's contact details, for prefilling the forms below. */
  viewer?: { fullName: string; phone: string };
  /** Resolved on the server, so "notify me" knows where to send a visitor. */
  loggedIn: boolean;
  /** Whether this viewer already asked to be told about the event. */
  notified: boolean;
  className?: string;
}) {
  const state = resolveBuyState(event, tickets);
  const { action } = state;
  const checkout = `/events/${event.id}/checkout`;
  // Any bookable showing with a pinned map means the buyer picks seats.
  const reserved = event.sessions.some(
    (s) => !s.cancelled && s.layoutVersionId,
  );

  let node: React.ReactNode;
  switch (action.type) {
    case "approval":
      node = (
        <RequestToJoin
          eventId={event.id}
          label={action.label}
          defaultName={viewer?.fullName}
          defaultPhone={viewer?.phone}
        />
      );
      break;
    case "buy":
      node = (
        <Link
          href={checkout}
          className={buttonVariants({ variant: "primary", size: "lg" })}
        >
          {reserved ? <Armchair aria-hidden /> : <Ticket aria-hidden />}
          {reserved ? "انتخاب صندلی" : action.label}
        </Link>
      );
      break;
    case "notify":
      node = (
        <NotifyMe
          eventId={event.id}
          loggedIn={loggedIn}
          initialNotified={notified}
          idleLabel={action.label}
        />
      );
      break;
    case "waitlist":
      node = (
        <JoinWaitlist eventId={event.id} label={action.label} viewer={viewer} />
      );
      break;
    case "closed":
      node = (
        <span
          aria-disabled
          className={cn(
            buttonVariants({ variant: "secondary", size: "lg" }),
            "cursor-not-allowed opacity-60",
          )}
        >
          {action.label}
        </span>
      );
      break;
  }

  return (
    <BuyBox
      badge={state.badge}
      title={state.title}
      original={state.original}
      subtitle={state.subtitle}
      action={node}
      className={className}
    />
  );
}

function Location({
  event,
  online,
  pin,
}: {
  event: Event;
  online: boolean;
  pin: { lat: number; lng: number } | null;
}) {
  const { venue } = event;
  const fullAddress = [venue.name, venue.province, venue.city, venue.address]
    .filter(Boolean)
    .join("، ");
  const d = 0.02;
  const bbox = pin
    ? `${pin.lng - d},${pin.lat - d},${pin.lng + d},${pin.lat + d}`
    : "";

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        {online ? (
          <Video className="size-4 text-faint" aria-hidden />
        ) : (
          <MapPin className="size-4 text-faint" aria-hidden />
        )}
        {online ? "رویداد آنلاین" : "مکان"}
      </h2>

      {online ? (
        <p className="text-sm text-muted">
          این رویداد به‌صورت آنلاین برگزار می‌شود. لینک ورود پس از تهیه بلیت در
          اختیار شما قرار می‌گیرد.
        </p>
      ) : venue.hideAddress ? (
        <p className="text-sm text-faint">
          آدرس دقیق و موقعیت روی نقشه برای این رویداد نمایش داده نمی‌شود.
        </p>
      ) : fullAddress ? (
        <div className="overflow-hidden rounded-2xl border border-border">
          {pin ? (
            <iframe
              title="نقشه مکان رویداد"
              className="block h-72 w-full"
              loading="lazy"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${pin.lat},${pin.lng}`}
            />
          ) : null}
          <div className="flex items-start justify-between gap-4 bg-card p-4">
            <p className="flex items-start gap-2 text-sm leading-6 text-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden />
              {fullAddress}
            </p>
            {pin ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${pin.lat},${pin.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-sm font-medium text-accent-text underline-offset-4 hover:underline"
              >
                مسیریابی
              </a>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">مکان رویداد اعلام نشده است.</p>
      )}
    </section>
  );
}

function Hosts({
  organizer,
  collaborators,
  className,
}: {
  organizer: Workspace | undefined;
  collaborators: EventCollaborator[];
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-lg",
        className,
      )}
    >
      <h2 className="mb-3 text-sm font-semibold text-foreground">
        برگزارکنندگان
      </h2>
      <div className="flex flex-col gap-1">
        {organizer ? (
          <HostRow
            href={`/w/${organizer.slug}`}
            avatar={organizer.avatar}
            name={organizer.name}
            role="برگزارکننده"
            verified={organizer.verified}
          />
        ) : null}
        {collaborators.map((c) => (
          <HostRow
            key={c.id}
            href={c.workspaceSlug ? `/w/${c.workspaceSlug}` : undefined}
            avatar={c.avatar ?? "؟"}
            name={c.label}
            role="همکار"
          />
        ))}
        {!organizer && collaborators.length === 0 ? (
          <p className="text-sm text-muted">—</p>
        ) : null}
      </div>
    </section>
  );
}

function HostRow({
  href,
  avatar,
  name,
  role,
  verified,
}: {
  href?: string;
  avatar: string;
  name: string;
  role: string;
  verified?: boolean;
}) {
  const inner = (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-foreground text-sm font-bold text-background">
        {avatar}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-sm font-medium text-foreground">
          <span className="truncate">{name}</span>
          {verified ? (
            <BadgeCheck className="size-4 shrink-0 text-accent-text" aria-label="تأییدشده" />
          ) : null}
        </span>
        <span className="block text-xs text-muted">{role}</span>
      </span>
    </>
  );
  return href ? (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg p-1.5 outline-none transition-colors hover:bg-subtle focus-visible:bg-subtle"
    >
      {inner}
    </Link>
  ) : (
    <div className="flex items-center gap-3 p-1.5">{inner}</div>
  );
}
