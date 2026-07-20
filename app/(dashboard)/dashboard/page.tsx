import type { Metadata } from "next";
import Link from "next/link";
import {
  Plus,
  TrendingUp,
  Ticket as TicketIcon,
  Percent,
  CalendarDays,
  CalendarClock,
  MapPin,
  Layers,
  ChevronLeft,
} from "lucide-react";

import { listEvents, listTickets } from "@/lib/server";
import { computeAnalytics, computeByEvent } from "@/lib/analytics/compute";
import {
  formatToman,
  formatNumber,
  formatJalaliDate,
  formatTime,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { EventStatusBadge } from "@/components/dashboard/EventStatusBadge";

export const metadata: Metadata = { title: "داشبورد | پوستر" };

const faPercent = (ratio: number) =>
  `${(ratio * 100).toLocaleString("fa-IR", { maximumFractionDigits: 0 })}٪`;

export default function DashboardHome() {
  const events = listEvents();
  const analytics = computeAnalytics();
  const byEvent = computeByEvent();
  const maxSold = Math.max(...analytics.byCategory.map((c) => c.sold), 1);

  // Sessions-first, like the composer: gather every session, soonest first.
  const upcoming = events
    .flatMap((e) => e.sessions.map((session) => ({ event: e, session })))
    .sort((a, b) => a.session.startAt.localeCompare(b.session.startAt))
    .slice(0, 5);

  const published = events.filter((e) => e.status === "published").length;

  const kpis = [
    { label: "درآمد کل", value: formatToman(analytics.revenue), icon: TrendingUp },
    { label: "بلیت فروخته‌شده", value: formatNumber(analytics.ticketsSold), icon: TicketIcon },
    { label: "نرخ پر شدن ظرفیت", value: faPercent(analytics.conversion), icon: Percent },
    { label: "رویدادهای منتشرشده", value: formatNumber(published), icon: CalendarDays },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            داشبورد
          </h1>
          <p className="mt-1 text-sm text-muted">
            نمای کلی فروش، سانس‌ها و بلیت‌های رویدادهای شما.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-border bg-subtle px-2.5 py-1 text-xs text-muted">
            داده‌های نمونه
          </span>
          <Link
            href="/tickets/create"
            className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
          >
            <Plus aria-hidden />
            <span className="hidden sm:inline">ساخت رویداد</span>
          </Link>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-subtle text-accent">
            <CalendarDays className="size-6" aria-hidden />
          </span>
          <h2 className="text-base font-semibold text-foreground">
            هنوز رویدادی نساخته‌اید
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            اولین رویدادتان را بسازید تا سانس‌ها، انواع بلیت و فروش اینجا نمایش
            داده شوند.
          </p>
          <Link
            href="/tickets/create"
            className={cn(buttonVariants({ variant: "primary", size: "sm" }), "mt-5")}
          >
            <Plus aria-hidden />
            ساخت رویداد
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {kpis.map((k) => {
              const Icon = k.icon;
              return (
                <div
                  key={k.label}
                  className="rounded-lg border border-border bg-card p-5"
                >
                  <Icon className="size-5 text-faint" aria-hidden />
                  <div className="mt-3 text-xl font-bold text-foreground">
                    {k.value}
                  </div>
                  <div className="mt-1 text-sm text-muted">{k.label}</div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            {/* Events with capacity utilization — the organizer's core objects. */}
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">
                  رویدادهای شما
                </h2>
                <Link
                  href="/dashboard/events"
                  className="text-xs text-muted underline-offset-4 hover:text-foreground hover:underline"
                >
                  مشاهدهٔ همه
                </Link>
              </div>
              <div className="flex flex-col gap-3">
                {events.map((event) => {
                  const stat = byEvent[event.id] ?? {
                    sold: 0,
                    capacity: 0,
                    revenue: 0,
                  };
                  const types = listTickets(event.id);
                  const fill = stat.capacity
                    ? Math.min(1, stat.sold / stat.capacity)
                    : 0;
                  const city =
                    [event.venue.province, event.venue.city]
                      .filter(Boolean)
                      .join("، ") || event.venue.city;
                  return (
                    <Link
                      key={event.id}
                      href={`/dashboard/events/${event.id}`}
                      className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-border-strong"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-foreground">
                              {event.title}
                            </p>
                            <EventStatusBadge status={event.status} />
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3.5 text-faint" aria-hidden />
                              {city}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <CalendarClock className="size-3.5 text-faint" aria-hidden />
                              {formatNumber(event.sessions.length)} سانس
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Layers className="size-3.5 text-faint" aria-hidden />
                              {formatNumber(types.length)} نوع بلیت
                            </span>
                          </div>
                        </div>
                        <ChevronLeft
                          className="size-4 shrink-0 text-faint transition-transform group-hover:-translate-x-0.5"
                          aria-hidden
                        />
                      </div>
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted">
                            {formatNumber(stat.sold)} از {formatNumber(stat.capacity)} فروخته‌شده
                          </span>
                          <span className="font-medium text-foreground">
                            {formatToman(stat.revenue)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-subtle">
                          <span
                            className="block h-full rounded-full bg-accent shadow-[0_0_12px_-2px_var(--accent)]"
                            style={{ width: `${fill * 100}%` }}
                          />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>

            {/* Right rail: sessions-first schedule + ticket sales mix. */}
            <div className="flex flex-col gap-6">
              <section className="rounded-lg border border-border bg-card p-5">
                <h2 className="mb-4 text-sm font-semibold text-foreground">
                  سانس‌های پیش‌رو
                </h2>
                {upcoming.length > 0 ? (
                  <ul className="flex flex-col gap-3">
                    {upcoming.map(({ event, session }) => (
                      <li key={session.id} className="flex items-start gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-md border border-border bg-subtle text-accent">
                          <CalendarClock className="size-4" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground">
                            {event.title}
                          </p>
                          <p className="mt-0.5 text-xs text-muted">
                            {formatJalaliDate(session.startAt)} · {formatTime(session.startAt)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">سانسی ثبت نشده است.</p>
                )}
              </section>

              <section className="rounded-lg border border-border bg-card p-5">
                <h2 className="mb-4 text-sm font-semibold text-foreground">
                  ترکیب فروش بلیت
                </h2>
                {analytics.byCategory.length > 0 ? (
                  <ul className="flex flex-col gap-3">
                    {analytics.byCategory.map((c) => (
                      <li key={c.category} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-foreground">{c.label}</span>
                          <span className="text-muted">
                            {formatNumber(c.sold)} بلیت
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-subtle">
                          <span
                            className="block h-full rounded-full bg-accent"
                            style={{ width: `${(c.sold / maxSold) * 100}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">هنوز بلیتی تعریف نشده است.</p>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
