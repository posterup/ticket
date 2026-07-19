import { Ticket } from "lucide-react";

import { cn } from "@/lib/utils";

export interface TicketTemplate {
  accent: string;
  theme: "light" | "dark";
  showCategory: boolean;
  showSeat: boolean;
  showDate: boolean;
  showVenue: boolean;
  note: string;
}

export interface TicketSample {
  eventTitle: string;
  holder: string;
  category: string;
  seat: string;
  date: string;
  venue: string;
}

// Fixed QR-like pattern (kept static, always on a light chip so it stays scannable).
const QR = [
  1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0,
  1, 0, 1, 1, 0, 1, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 1,
];

/** Live preview of the issued ticket, driven by a customizable template. */
export function TicketPreview({
  template,
  sample,
}: {
  template: TicketTemplate;
  sample: TicketSample;
}) {
  const dark = template.theme === "dark";
  const fields: { show: boolean; label: string; value: string; badge?: boolean }[] =
    [
      { show: template.showCategory, label: "دسته", value: sample.category, badge: true },
      { show: template.showSeat, label: "جایگاه", value: sample.seat },
      { show: template.showDate, label: "تاریخ", value: sample.date },
      { show: template.showVenue, label: "مکان", value: sample.venue },
    ];

  return (
    <div
      style={{ ["--tk" as string]: template.accent }}
      className={cn(
        "mx-auto w-full max-w-sm overflow-hidden rounded-xl border shadow-sm",
        dark ? "border-white/10 bg-neutral-900" : "border-border bg-white",
      )}
    >
      <div
        className="flex items-center justify-between gap-3 p-5 text-white"
        style={{ backgroundColor: "var(--tk)" }}
      >
        <div className="min-w-0">
          <p className="text-xs opacity-80">بلیت ورود</p>
          <p className="truncate text-base font-bold">{sample.eventTitle}</p>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/20">
          <Ticket className="size-5" aria-hidden />
        </span>
      </div>

      <div className="p-5">
        <p className={cn("text-xs", dark ? "text-white/50" : "text-faint")}>
          دارنده بلیت
        </p>
        <p className={cn("text-lg font-semibold", dark ? "text-white" : "text-neutral-900")}>
          {sample.holder}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {fields
            .filter((f) => f.show)
            .map((f) => (
              <div key={f.label} className="flex flex-col gap-1">
                <dt className={cn("text-xs", dark ? "text-white/50" : "text-faint")}>
                  {f.label}
                </dt>
                {f.badge ? (
                  <dd>
                    <span
                      className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: "var(--tk)" }}
                    >
                      {f.value}
                    </span>
                  </dd>
                ) : (
                  <dd className={cn("font-medium", dark ? "text-white" : "text-neutral-900")}>
                    {f.value}
                  </dd>
                )}
              </div>
            ))}
        </dl>
      </div>

      <div
        className={cn(
          "flex items-center gap-4 border-t border-dashed p-5",
          dark ? "border-white/15" : "border-border",
        )}
      >
        <div className="grid shrink-0 grid-cols-7 gap-[2px] rounded-lg bg-white p-2 shadow-sm">
          {QR.map((cell, i) => (
            <span
              key={i}
              className={cn("size-1.5 rounded-[1px]", cell ? "bg-neutral-900" : "bg-transparent")}
            />
          ))}
        </div>
        <p className={cn("text-xs leading-relaxed", dark ? "text-white/60" : "text-muted")}>
          {template.note || "این بلیت را هنگام ورود ارائه دهید."}
        </p>
      </div>
    </div>
  );
}
