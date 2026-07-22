import Image from "next/image";
import { Ticket } from "lucide-react";

import { cn } from "@/lib/utils";

export interface TicketTemplate {
  accent: string;
  /** Text/base theme of the ticket body. */
  surface: "light" | "dark";
  /** Optional custom body background color. */
  bgColor: string | null;
  /** Optional body background image (data URL). */
  bgImage: string | null;
  /** Optional uploaded logo (data URL). */
  logo: string | null;
  showCategory: boolean;
  showDate: boolean;
  showVenue: boolean;
  note: string;
}

export interface TicketSample {
  eventTitle: string;
  holder: string;
  category: string;
  date: string;
  venue: string;
}

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
  const dark = template.surface === "dark";
  const strong = dark ? "text-white" : "text-neutral-900";
  const muted = dark ? "text-white/60" : "text-faint";
  const label = dark ? "text-white/50" : "text-faint";

  const bodyStyle: React.CSSProperties = template.bgImage
    ? {
        backgroundImage: `url(${template.bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : template.bgColor
      ? { backgroundColor: template.bgColor }
      : {};

  const fields: {
    show: boolean;
    label: string;
    value: string;
    badge?: boolean;
  }[] = [
    { show: template.showCategory, label: "دسته", value: sample.category, badge: true },
    { show: template.showDate, label: "تاریخ", value: sample.date },
    { show: template.showVenue, label: "مکان", value: sample.venue },
  ];

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-sm overflow-hidden rounded-xl border shadow-sm",
        dark ? "border-white/10" : "border-border",
      )}
    >
      {/* Accent header with brand mark / logo */}
      <div
        className="flex items-center justify-between gap-3 p-5 text-white"
        style={{ backgroundColor: template.accent }}
      >
        <div className="min-w-0">
          <p className="text-xs opacity-80">بلیت ورود</p>
          <p className="truncate text-base font-bold">{sample.eventTitle}</p>
        </div>
        {template.logo ? (
          <span className="grid h-9 shrink-0 place-items-center rounded-md bg-white px-1.5">
            <Image
              src={template.logo}
              alt="لوگو"
              width={80}
              height={28}
              className="h-7 w-auto object-contain"
              unoptimized
            />
          </span>
        ) : (
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/20">
            <Ticket className="size-5" aria-hidden />
          </span>
        )}
      </div>

      {/* Body (surface / custom color / image) */}
      <div className="relative" style={bodyStyle}>
        {template.bgImage ? (
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: dark
                ? "rgba(0,0,0,0.55)"
                : "rgba(255,255,255,0.82)",
            }}
          />
        ) : !template.bgColor ? (
          <div
            className={cn("absolute inset-0", dark ? "bg-neutral-900" : "bg-white")}
          />
        ) : null}

        <div className="relative p-5">
          <p className={cn("text-xs", label)}>دارنده بلیت</p>
          <p className={cn("text-lg font-semibold", strong)}>{sample.holder}</p>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {fields
              .filter((f) => f.show)
              .map((f) => (
                <div key={f.label} className="flex flex-col gap-1">
                  <dt className={cn("text-xs", label)}>{f.label}</dt>
                  {f.badge ? (
                    <dd>
                      <span
                        className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: template.accent }}
                      >
                        {f.value}
                      </span>
                    </dd>
                  ) : (
                    <dd className={cn("font-medium", strong)}>{f.value}</dd>
                  )}
                </div>
              ))}
          </dl>
        </div>

        <div
          className={cn(
            "relative flex items-center gap-4 border-t border-dashed p-5",
            dark ? "border-white/20" : "border-black/15",
          )}
        >
          <div className="grid shrink-0 grid-cols-7 gap-[2px] rounded-lg bg-white p-2 shadow-sm">
            {QR.map((cell, i) => (
              <span
                key={i}
                className={cn(
                  "size-1.5 rounded-[1px]",
                  cell ? "bg-neutral-900" : "bg-transparent",
                )}
              />
            ))}
          </div>
          <p className={cn("text-xs leading-relaxed", muted)}>
            {template.note || "این بلیت را هنگام ورود ارائه دهید."}
          </p>
        </div>
      </div>
    </div>
  );
}
