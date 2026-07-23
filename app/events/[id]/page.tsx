import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MapPin,
  Clock,
  ChevronLeft,
  BadgeCheck,
  Ticket,
  Video,
  User,
} from "lucide-react";

import {
  getEventByIdOrSlug,
  listTickets,
  getWorkspaceByEvent,
  listAcceptedCollaborators,
} from "@/lib/server";
import {
  formatJalaliDate,
  formatTime,
  formatToman,
} from "@/lib/format";
import { cityCoords } from "@/lib/geo/iran";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import { EventCover } from "@/components/events/EventCover";
import type { Event, EventCollaborator, Workspace } from "@/types";

interface Params {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const event = getEventByIdOrSlug(id);
  return { title: event ? `${event.title} | پوستر` : "رویداد | پوستر" };
}

function priceLabel(prices: number[]): string | null {
  if (prices.length === 0) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === 0 && max === 0) return "رایگان";
  return min === max ? formatToman(min) : `از ${formatToman(min)}`;
}

export default async function PublicEventDetail({ params }: Params) {
  const { id } = await params;
  const event = getEventByIdOrSlug(id);
  if (!event) notFound();

  const tickets = listTickets(event.id);
  const organizer = getWorkspaceByEvent(event.id);
  const collaborators = listAcceptedCollaborators(event.id);
  const price = priceLabel(tickets.map((t) => t.price));

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
              tags={event.tags}
              className="aspect-[16/9] rounded-2xl"
            />

            {/* 1b. Title + meta */}
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {event.title}
              </h1>

              {/* location · organizer */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <p className="flex items-center gap-1.5 text-sm text-muted">
                  {online ? (
                    <Video className="size-4 shrink-0 text-faint" aria-hidden />
                  ) : (
                    <MapPin className="size-4 shrink-0 text-faint" aria-hidden />
                  )}
                  {online
                    ? "رویداد آنلاین"
                    : [event.venue.name, event.venue.city]
                        .filter(Boolean)
                        .join("، ") || "مکان نامشخص"}
                </p>
                {organizer ? (
                  <Link
                    href={`/w/${organizer.slug}`}
                    className="flex items-center gap-1.5 text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
                  >
                    <User className="size-4 shrink-0 text-faint" aria-hidden />
                    <span className="font-medium text-foreground">
                      {organizer.name}
                    </span>
                  </Link>
                ) : null}
              </div>

              {/* sessions — chips */}
              <div className="mt-4 flex flex-wrap gap-2">
                {sessions.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-subtle px-3 py-1 text-xs font-medium text-muted"
                  >
                    <Clock className="size-3.5 text-faint" aria-hidden />
                    {formatJalaliDate(s.startAt)} · {formatTime(s.startAt)} تا{" "}
                    {formatTime(s.endAt)}
                  </span>
                ))}
              </div>
            </div>

            {/* 3. Ticket buy card — mobile */}
            <BuyCard
              eventId={event.id}
              price={price}
              boxed
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
            <BuyCard eventId={event.id} price={price} boxed />
            <Hosts organizer={organizer} collaborators={collaborators} />
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function BuyCard({
  eventId,
  price,
  boxed,
  className,
}: {
  eventId: string;
  price: string | null;
  boxed?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(boxed && "rounded-2xl border border-border bg-card p-5 shadow-lg", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted">قیمت</span>
        <span className="text-lg font-bold text-foreground">{price ?? "به‌زودی"}</span>
      </div>
      {price ? (
        <Link
          href={`/events/${eventId}/checkout`}
          className={cn(buttonVariants({ variant: "primary", size: "lg" }), "mt-4 w-full")}
        >
          <Ticket aria-hidden />
          تهیه بلیت
        </Link>
      ) : (
        <p className="mt-4 rounded-md border border-dashed border-border p-3 text-center text-xs text-muted">
          فروش بلیت هنوز آغاز نشده است.
        </p>
      )}
    </div>
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
                className="shrink-0 text-sm font-medium text-accent underline-offset-4 hover:underline"
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
        برگزارکننده و همکاران
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
            <BadgeCheck className="size-4 shrink-0 text-accent" aria-label="تأییدشده" />
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
