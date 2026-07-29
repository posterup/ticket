import type { Metadata } from "next";

import {
  listCheckedTicketIds,
  listEventsByWorkspaceId,
  listHolders,
} from "@/lib/server";
import { requireManagerPage } from "@/lib/server/auth/guards";
import { formatJalaliDate, formatTime } from "@/lib/format";
import {
  CheckinPanel,
  type CheckinEvent,
} from "@/components/checkin/CheckinPanel";

export const metadata: Metadata = { title: "پذیرش | پوستر" };

export default async function CheckinPage() {
  const { workspace } = await requireManagerPage();

  const allEvents = await listEventsByWorkspaceId(workspace.workspaceId);

  const events: CheckinEvent[] = await Promise.all(
    allEvents.map(async (e) => {
      const sessions = e.sessions.map((s) => ({
        id: s.id,
        label: `${formatJalaliDate(s.startAt)} · ${formatTime(s.startAt)}`,
      }));
      const labels = new Map(sessions.map((s) => [s.id, s.label]));
      return {
        id: e.id,
        title: e.title,
        sessions,
        holders: await listHolders(e.id, labels),
      };
    }),
  );

  // Only events with tickets sold have anyone to admit.
  const withHolders = events.filter((e) => e.holders.length > 0);
  const initialChecked = (
    await Promise.all(withHolders.map((e) => listCheckedTicketIds(e.id)))
  ).flat();

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
      <CheckinPanel
        events={withHolders.length > 0 ? withHolders : events}
        initialChecked={initialChecked}
      />
    </div>
  );
}
