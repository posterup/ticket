import type { Metadata } from "next";

import { listEvents, listCheckedHolderIds } from "@/lib/server";
import { buildHolders } from "@/lib/checkin/data";
import { formatJalaliDate, formatTime } from "@/lib/format";
import {
  CheckinPanel,
  type CheckinEvent,
} from "@/components/checkin/CheckinPanel";

export const metadata: Metadata = { title: "پذیرش | پوستر" };

export default function CheckinPage() {
  const events: CheckinEvent[] = listEvents().map((e, i) => {
    const sessions = e.sessions.map((s) => ({
      id: s.id,
      label: `${formatJalaliDate(s.startAt)} · ${formatTime(s.startAt)}`,
    }));
    return {
      id: e.id,
      title: e.title,
      sessions,
      holders: buildHolders(e.id, i, sessions),
    };
  });

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
      <CheckinPanel events={events} initialChecked={listCheckedHolderIds()} />
    </div>
  );
}
