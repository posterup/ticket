import type { Metadata } from "next";

import { TicketDesigner } from "@/components/tickets/TicketDesigner";

export const metadata: Metadata = { title: "قالب بلیت | پوستر" };

export default function CustomizeTicketPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          قالب بلیت
        </h1>
        <p className="mt-1 text-sm text-muted">
          ظاهر بلیت صادرشده را با برند خود سفارشی کنید و پیش‌نمایش زنده را ببینید.
        </p>
      </div>
      <TicketDesigner />
    </div>
  );
}
