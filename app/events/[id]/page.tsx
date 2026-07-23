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
  formatNumber,
} from "@/lib/format";
import { cityCoords } from "@/lib/geo/iran";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import { EventCover } from "@/components/events/EventCover";
import { NotifyMe } from "@/components/events/NotifyMe";
import { BuyBox, type BadgeTone } from "@/components/events/BuyBox";
import type {
  Event,
  EventCollaborator,
  TicketType,
  Workspace,
} from "@/types";

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
            <BuyCard event={event} tickets={tickets} className="lg:hidden" />

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
            <BuyCard event={event} tickets={tickets} />
            <Hosts organizer={organizer} collaborators={collaborators} />
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}

/** How the buy-box action behaves for a given sales state. */
type BuyAction =
  | { type: "buy"; label: string }
  | { type: "approval"; label: string }
  | { type: "notify"; label: string }
  | { type: "waitlist"; label: string }
  | { type: "closed"; label: string };

interface BuyState {
  badge?: { label: string; tone: BadgeTone };
  title: string;
  /** Struck-through original price when `title` is a discounted deal. */
  original?: string;
  subtitle?: string;
  action: BuyAction;
}

const toIso = (ms: number) => new Date(ms).toISOString();

/**
 * Resolve the single sales state to show for an event, from ticket windows,
 * price, stock, and the approval/waitlist flags.
 */
function resolveBuyState(event: Event, tickets: TicketType[]): BuyState {
  const now = Date.now();
  const prices = tickets.map((t) => t.price);
  const price = priceLabel(prices);
  const starts = tickets.map((t) => new Date(t.salesStartAt).getTime());
  const ends = tickets.map((t) => new Date(t.salesEndAt).getTime());
  const salesStart = starts.length ? Math.min(...starts) : Infinity;
  const salesEnd = ends.length ? Math.max(...ends) : -Infinity;
  const capacity = tickets.reduce((sum, t) => sum + (t.capacity || 0), 0);
  const sold = tickets.reduce((sum, t) => sum + (t.sold ?? 0), 0);
  const remaining = capacity - sold;

  // 2. Sales haven't started (or no tickets yet).
  if (tickets.length === 0 || now < salesStart) {
    return {
      badge: { label: "به‌زودی", tone: "neutral" },
      title: "فروش هنوز شروع نشده",
      subtitle: tickets.length
        ? `شروع فروش: ${formatJalaliDate(toIso(salesStart))}`
        : undefined,
      action: { type: "notify", label: "خبرم کن" },
    };
  }

  // 7 & 8. Sold out — stock exhausted or the sales window has ended.
  const soldOut = (capacity > 0 && remaining <= 0) || now > salesEnd;
  if (soldOut) {
    return event.waitlist
      ? {
          badge: { label: "تکمیل ظرفیت", tone: "danger" },
          title: "بلیت‌ها تمام شد",
          subtitle: "برای لیست انتظار ثبت‌نام کنید",
          action: { type: "waitlist", label: "لیست انتظار" },
        }
      : {
          badge: { label: "تکمیل ظرفیت", tone: "danger" },
          title: "بلیت‌ها تمام شد",
          subtitle: "فروش این رویداد پایان یافت",
          action: { type: "closed", label: "فروش بسته شد" },
        };
  }

  // 4. Registration needs organiser approval.
  if (event.requiresApproval) {
    return {
      badge: { label: "با تأیید میزبان", tone: "accent" },
      title: price ?? "ثبت درخواست",
      subtitle: "پس از تأیید میزبان قطعی می‌شود",
      action: { type: "approval", label: "درخواست ثبت‌نام" },
    };
  }

  // 1. Free.
  if (Math.min(...prices) === 0) {
    return {
      badge: { label: "رایگان", tone: "success" },
      title: "ورود آزاد",
      subtitle: "بلیت این رویداد رایگان است",
      action: { type: "buy", label: "دریافت بلیت" },
    };
  }

  // 3. An early-bird ticket is currently on sale.
  const early = tickets.filter(
    (t) =>
      t.category === "early-bird" &&
      new Date(t.salesStartAt).getTime() <= now &&
      now <= new Date(t.salesEndAt).getTime(),
  );
  if (early.length) {
    const earlyEnd = Math.min(
      ...early.map((t) => new Date(t.salesEndAt).getTime()),
    );
    const dealPrice = Math.min(...early.map((t) => t.price));
    const regular = tickets
      .filter((t) => t.category !== "early-bird")
      .map((t) => t.price);
    const fullPrice = regular.length ? Math.min(...regular) : dealPrice;
    return {
      badge: { label: "فروش ویژه", tone: "accent" },
      title: formatToman(dealPrice),
      original:
        fullPrice > dealPrice ? formatToman(fullPrice) : undefined,
      subtitle: `بلیت زودهنگام — تا ${formatJalaliDate(toIso(earlyEnd))}`,
      action: { type: "buy", label: "تهیه بلیت" },
    };
  }

  // 5. Almost done — low remaining stock (≤ 10% of capacity).
  if (capacity > 0 && remaining > 0 && remaining <= Math.max(1, capacity * 0.1)) {
    return {
      badge: { label: "آخرین بلیت‌ها", tone: "warning" },
      title: price ?? "",
      subtitle: `تنها ${formatNumber(remaining)} بلیت باقی مانده`,
      action: { type: "buy", label: "تهیه بلیت" },
    };
  }

  // 6. Normal on-sale.
  return {
    badge: undefined,
    title: price ?? "",
    subtitle: undefined,
    action: { type: "buy", label: "تهیه بلیت" },
  };
}

function BuyCard({
  event,
  tickets,
  className,
}: {
  event: Event;
  tickets: TicketType[];
  className?: string;
}) {
  const state = resolveBuyState(event, tickets);
  const { action } = state;
  const checkout = `/events/${event.id}/checkout`;

  let node: React.ReactNode;
  switch (action.type) {
    case "buy":
    case "approval":
      node = (
        <Link
          href={checkout}
          className={buttonVariants({ variant: "primary", size: "lg" })}
        >
          <Ticket aria-hidden />
          {action.label}
        </Link>
      );
      break;
    case "notify":
      node = <NotifyMe eventId={event.id} idleLabel={action.label} />;
      break;
    case "waitlist":
      node = (
        <NotifyMe
          eventId={event.id}
          idleLabel={action.label}
          activeLabel="در لیست انتظار"
        />
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
