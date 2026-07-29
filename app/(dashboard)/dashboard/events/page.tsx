"use client";

import { useApi } from "@/lib/client/api";
import { useActiveWorkspace } from "@/components/dashboard/ActiveWorkspace";
import { AsyncState } from "@/components/ui/async-state";
import { EventsTimeline } from "@/components/dashboard/EventsTimeline";
import type { Event } from "@/types";

export default function EventsPage() {
  const workspace = useActiveWorkspace();
  // Waits for the workspace rather than fetching an unscoped list first and
  // correcting it — that flash is what made switching look broken.
  const { data, error, loading, reload } = useApi<Event[]>(
    workspace ? `/api/workspaces/${workspace.slug}/events` : null,
  );

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

      {data ? (
        <EventsTimeline events={data} />
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
