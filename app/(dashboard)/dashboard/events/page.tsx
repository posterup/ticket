import type { Metadata } from "next";

import { listEvents } from "@/lib/server";
import { EventsTimeline } from "@/components/dashboard/EventsTimeline";
import { requireManagerPage } from "@/lib/server/auth/guards";

export const metadata: Metadata = { title: "رویدادها | پوستر" };

export default async function EventsPage() {
  await requireManagerPage();

  const events = await listEvents();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          رویدادها
        </h1>
        <p className="mt-1 text-sm text-muted">
          رویدادهای شما روی یک خط زمانی، دسته‌بندی‌شده بر اساس ماه.
        </p>
      </div>

      <EventsTimeline events={events} />
    </div>
  );
}
