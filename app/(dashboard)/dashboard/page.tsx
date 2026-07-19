import type { Metadata } from "next";
import { CalendarDays, Users, Ticket, Armchair } from "lucide-react";

import { listEvents, listTickets, listAttendees } from "@/lib/server";

export const metadata: Metadata = { title: "داشبورد | پوستر" };

const fa = (n: number) => n.toLocaleString("fa-IR");

export default function DashboardHome() {
  const events = listEvents();
  const ticketTypes = listTickets();
  const attendees = listAttendees();
  const totalCapacity = ticketTypes.reduce((sum, t) => sum + t.capacity, 0);

  const stats = [
    { label: "رویدادها", value: fa(events.length), icon: CalendarDays },
    { label: "مشتریان", value: fa(attendees.length), icon: Users },
    { label: "انواع بلیت", value: fa(ticketTypes.length), icon: Ticket },
    { label: "ظرفیت بلیت", value: fa(totalCapacity), icon: Armchair },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          داشبورد
        </h1>
        <p className="mt-1 text-sm text-muted">
          نمای کلی رویدادها، بلیت‌ها و مخاطبان شما.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="rounded-lg border border-border bg-card p-5"
            >
              <Icon className="size-5 text-faint" aria-hidden />
              <div className="mt-3 text-2xl font-bold text-foreground">
                {s.value}
              </div>
              <div className="mt-1 text-sm text-muted">{s.label}</div>
            </div>
          );
        })}
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">رویدادهای اخیر</h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <ul className="divide-y divide-border">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {event.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {event.venue.name}، {event.venue.city}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-subtle px-2.5 py-1 text-xs text-muted">
                  {fa(event.venue.capacity)} نفر
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
