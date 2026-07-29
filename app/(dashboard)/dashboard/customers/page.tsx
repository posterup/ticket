"use client";

import Link from "next/link";
import { QrCode, Megaphone } from "lucide-react";

import { useApi } from "@/lib/client/api";
import { useActiveWorkspace } from "@/components/dashboard/ActiveWorkspace";
import { AsyncState } from "@/components/ui/async-state";
import { formatJalaliDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";
import { ContactsTable, type Contact } from "@/components/dashboard/ContactsTable";
import type { Attendee } from "@/types";

interface Row {
  contact: Attendee;
  events: { id: string; title: string; startAt: string | null }[];
  spent: number;
}

export default function CustomersPage() {
  const workspace = useActiveWorkspace();
  const { data, error, loading, reload } = useApi<{ attendees: Row[] }>(
    workspace ? `/api/workspaces/${workspace.slug}/attendees` : null,
  );

  const contacts: Contact[] = (data?.attendees ?? []).map((row) => ({
    id: row.contact.id,
    fullName: row.contact.fullName,
    phone: row.contact.phone,
    tags: row.contact.tags.map((t) => t.label),
    events: row.events.map((e) => ({
      id: e.id,
      title: e.title,
      dateLabel: e.startAt ? formatJalaliDate(e.startAt) : "",
    })),
    spent: row.spent,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            مخاطبین
          </h1>
          <p className="mt-1 text-sm text-muted">
            کسانی که در رویدادهای شما شرکت کرده‌اند.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/checkin"
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            <QrCode className="size-4" aria-hidden />
            پذیرش
          </Link>
          <Link
            href="/dashboard/marketing"
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            <Megaphone className="size-4" aria-hidden />
            کمپین
          </Link>
        </div>
      </div>

      {data ? (
        <ContactsTable contacts={contacts} />
      ) : (
        <AsyncState
          loading={loading || !workspace}
          error={error}
          onRetry={reload}
        />
      )}
    </div>
  );
}
