import type { Metadata } from "next";
import { Bell } from "lucide-react";

export const metadata: Metadata = { title: "اعلان‌ها | پوستر" };

export default function NotificationsPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          اعلان‌ها
        </h1>
        <p className="mt-1 text-sm text-muted">
          به‌روزرسانی رویدادها، فروش بلیت و فعالیت مخاطبان.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-10 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-subtle text-muted">
          <Bell className="size-6" aria-hidden />
        </span>
        <p className="text-sm font-medium text-foreground">اعلانی ندارید</p>
        <p className="max-w-xs text-sm text-muted">
          وقتی رویدادی بلیت بفروشد یا مخاطبی فعالیتی داشته باشد، این‌جا مطلع
          می‌شوید.
        </p>
      </div>
    </div>
  );
}
