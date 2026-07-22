import type { Metadata } from "next";
import Link from "next/link";
import { QrCode, Megaphone } from "lucide-react";

import { listAttendees, listEventsByAttendee, listTickets } from "@/lib/server";
import { formatJalaliDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ContactsTable, type Contact } from "@/components/dashboard/ContactsTable";

export const metadata: Metadata = { title: "مخاطبین | پوستر" };

export default function CustomersPage() {
  const contacts: Contact[] = listAttendees().map((a) => {
    const joined = listEventsByAttendee(a.id);
    // Mock earnings: the cheapest ticket price of each joined event.
    const spent = joined.reduce((sum, e) => {
      const prices = listTickets(e.id).map((t) => t.price);
      return sum + (prices.length ? Math.min(...prices) : 0);
    }, 0);

    return {
      id: a.id,
      fullName: a.fullName,
      phone: a.phone,
      email: a.email,
      tags: a.tags.map((t) => t.label),
      events: joined.map((e) => ({
        id: e.id,
        title: e.title,
        dateLabel: e.sessions[0] ? formatJalaliDate(e.sessions[0].startAt) : "",
      })),
      spent,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            مخاطبین
          </h1>
          <p className="mt-1 text-sm text-muted">
            فهرست مخاطبان و مشتریان رویدادهای شما.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/checkin"
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            <QrCode aria-hidden />
            اسکن بلیت
          </Link>
          <Link
            href="/dashboard/marketing"
            className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
          >
            <Megaphone aria-hidden />
            کمپین پیامک/ایمیل
          </Link>
        </div>
      </div>

      <ContactsTable contacts={contacts} />
    </div>
  );
}
