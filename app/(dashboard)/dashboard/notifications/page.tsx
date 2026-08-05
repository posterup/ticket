"use client";

import { Bell } from "lucide-react";

import { PendingInvites } from "@/components/dashboard/PendingInvites";

/**
 * What needs the organiser's attention.
 *
 * Collaboration invites are the only thing that genuinely waits on a decision
 * today, so they are the page rather than one card on it. The previous version
 * was a hardcoded empty state that reported «اعلانی ندارید» even when an
 * invitation was sitting unanswered.
 */
export default function NotificationsPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          اعلان‌ها
        </h1>
        <p className="mt-1 text-sm text-muted">
          دعوت‌های همکاری و کارهایی که منتظر پاسخ شما هستند.
        </p>
      </div>

      <PendingInvites />

      <div className="flex items-start gap-2 rounded-lg bg-subtle px-3 py-2 text-xs text-muted">
        <Bell className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden />
        <span>
          اعلان فروش بلیت و فعالیت مخاطبان هنوز فعال نیست؛ فعلاً از پیامک و
          داشبورد رویداد پیگیری کنید.
        </span>
      </div>
    </div>
  );
}
