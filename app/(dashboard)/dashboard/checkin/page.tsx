"use client";

import { useApi } from "@/lib/client/api";
import { useActiveWorkspace } from "@/components/dashboard/ActiveWorkspace";
import { AsyncState } from "@/components/ui/async-state";
import {
  CheckinPanel,
  type CheckinEvent,
} from "@/components/checkin/CheckinPanel";
import type { Event } from "@/types";
import type { Holder, SessionRef } from "@/lib/server/checkins";
import { apiFetch } from "@/lib/client/api";
import { useEffect, useState } from "react";

interface Door {
  eventId: string;
  title: string;
  sessions: SessionRef[];
  holders: Holder[];
  checked: string[];
}

export default function CheckinPage() {
  const workspace = useActiveWorkspace();
  const events = useApi<Event[]>(
    workspace ? `/api/workspaces/${workspace.slug}/events` : null,
  );

  const [doors, setDoors] = useState<Door[] | null>(null);

  // Door lists are per event, so the list has to arrive first.
  useEffect(() => {
    if (!events.data) return;
    let live = true;
    Promise.all(
      events.data.map((e) =>
        apiFetch<Door>(`/api/events/${e.id}/holders`).catch(() => null),
      ),
    ).then((results) => {
      if (live) setDoors(results.filter((d): d is Door => d !== null));
    });
    return () => {
      live = false;
    };
  }, [events.data]);

  const withHolders = (doors ?? []).filter((d) => d.holders.length > 0);
  const shown = withHolders.length > 0 ? withHolders : (doors ?? []);

  const checkinEvents: CheckinEvent[] = shown.map((d) => ({
    id: d.eventId,
    title: d.title,
    sessions: d.sessions,
    holders: d.holders,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          پذیرش و ورود
        </h1>
        <p className="mt-1 text-sm text-muted">
          مهمانان را با اسکن کد بلیت یا جستجو ثبت ورود کنید.
        </p>
      </div>

      {doors ? (
        <CheckinPanel
          events={checkinEvents}
          initialChecked={shown.flatMap((d) => d.checked)}
        />
      ) : (
        <AsyncState
          loading={events.loading || !workspace || doors === null}
          error={events.error}
          onRetry={events.reload}
        />
      )}
    </div>
  );
}
