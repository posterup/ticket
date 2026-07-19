import type { Metadata } from "next";

import { listEvents } from "@/lib/server";
import { buildHolders } from "@/lib/checkin/data";
import {
  CheckinPanel,
  type CheckinEvent,
} from "@/components/checkin/CheckinPanel";

export const metadata: Metadata = { title: "پذیرش | پوستر" };

export default function CheckinPage() {
  const events: CheckinEvent[] = listEvents().map((e, i) => ({
    id: e.id,
    title: e.title,
    holders: buildHolders(e.id, i),
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
      <CheckinPanel events={events} />
    </div>
  );
}
