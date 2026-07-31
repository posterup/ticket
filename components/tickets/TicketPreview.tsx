import Image from "next/image";
import { Armchair, Ticket } from "lucide-react";

import { cn } from "@/lib/utils";
import { blend, inkOn, ticketInk } from "@/lib/contrast";
import { TicketQr } from "./TicketQr";

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
  /**
   * The assigned seat, already formatted — «بالکن · ردیف ب · صندلی ۱۲».
   *
   * Absent for open seating, where there is nothing to print.
   */
  seat?: string;
  /**
   * The real `qrToken`, when this is an issued ticket rather than the
   * organiser's preview. With one, a scannable code is drawn; without one the
   * placeholder grid below stands in.
   */
  qrToken?: string;
}

/**
 * Placeholder grid for the *designer's* preview, where there is no ticket and
 * so no token to encode. It is decoration and says so — an issued ticket
 * renders a real code through `TicketQr`.
 */
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
  const accentInk = inkOn(template.accent);

  /**
   * Ink for the body.
   *
   * A custom `bgColor` is the only case that needs deriving, and it needs it
   * badly: the light/dark switch does not move when the organiser picks a
   * colour, so `text-faint` labels went on being emitted over backgrounds they
   * cannot survive — 1.81:1 on `#999999`. With a background image the overlay
   * (`rgba(0,0,0,.55)` / `rgba(255,255,255,.82)`) is what the text actually
   * sits on, not the colour, so the switch is right there and stays.
   *
   * The two default bodies keep their exact classes rather than being routed
   * through `ticketInk` — they already measure 5.16:1 and 5.26:1, and rewriting
   * them would trade `--faint`'s brand tint for a neutral grey on every ticket
   * already in circulation, for no legibility gained.
   */
  const derived =
    template.bgColor && !template.bgImage
      ? ticketInk(template.bgColor)
      : undefined;

  const strong = dark ? "text-white" : "text-neutral-900";
  const muted = dark ? "text-white/60" : "text-faint";
  const label = dark ? "text-white/50" : "text-faint";
  const strongStyle = derived ? { color: derived.strong } : undefined;
  const mutedStyle = derived ? { color: derived.muted } : undefined;
  const labelStyle = derived ? { color: derived.label } : undefined;

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
      {/* Accent header with brand mark / logo. The ink follows the accent —
          see `inkOn`; a light custom accent used to print white on white. */}
      <div
        className="flex items-center justify-between gap-3 p-5"
        style={{ backgroundColor: template.accent, color: accentInk }}
      >
        <div className="min-w-0">
          <p className="text-xs opacity-80">بلیت ورود</p>
          <p className="truncate text-base font-bold">{sample.eventTitle}</p>
        </div>
        {template.logo ? (
          <span className="grid h-9 shrink-0 place-items-center rounded-md bg-white px-1.5">
            <Image
              src={template.logo}
              /*
                Decorative, so silent.
                
                It announced «لوگو» — the word "logo", which tells a screen
                reader user nothing they can act on and nothing the event title
                two lines up has not already said. The template carries no
                organiser name to put here instead, and inventing one would be
                worse than saying nothing. Empty alt is the correct marking for
                branding that repeats information already in the text.
              */
              alt=""
              width={80}
              height={28}
              className="h-7 w-auto object-contain"
              unoptimized
            />
          </span>
        ) : (
          <span
            className="grid size-9 shrink-0 place-items-center rounded-lg"
            /* Tints with the ink, so the chip stays visible on a light accent
               where a white wash would have disappeared into the header. */
            style={{
              backgroundColor:
                accentInk === "#ffffff"
                  ? "rgba(255,255,255,0.2)"
                  : "rgba(0,0,0,0.12)",
            }}
          >
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
          <p className={cn("text-xs", label)} style={labelStyle}>دارنده بلیت</p>
          <p className={cn("text-lg font-semibold", strong)} style={strongStyle}>
            {sample.holder}
          </p>

          {/*
            The seat, when there is one.
            
            Not behind a `show*` toggle like the date and the venue, and not a
            cell in the grid below them. Those are things an organiser may
            reasonably leave off a ticket; a seat number is not — it is the one
            field an usher reads after the code scans, and assigned seating is
            unusable without it. It was on the wallet card and nowhere on the
            ticket, so the artefact that *looks* like a ticket, and is what
            people screenshot and hold up at a door, omitted the only thing
            telling them where to sit.
          */}
          {sample.seat ? (
            <div
              className={cn(
                "mt-4 flex items-center gap-2 rounded-lg px-3 py-2",
                // A tint on the two default bodies, where there is contrast to
                // spare: 15.7:1 and 13.5:1 for the seat text sitting on it.
                !derived && (dark ? "bg-white/10" : "bg-black/[0.06]"),
                // On a custom body, an outline instead — no fill.
                //
                // The tint version measured 3.83:1 there, *below* the 4.19:1 the
                // same ink gets on the bare background: the chip was spending
                // contrast to decorate the one field that can least afford it.
                // A border delineates the seat just as well and costs nothing,
                // so the number keeps whatever `inkOn` could win for it.
                derived && "border",
              )}
              style={
                derived
                  ? { borderColor: blend(derived.strong, template.bgColor!, 0.3) }
                  : undefined
              }
            >
              <Armchair
                className={cn("size-4 shrink-0", muted)}
                style={mutedStyle}
                aria-hidden
              />
              <span className={cn("text-sm font-bold", strong)} style={strongStyle}>
                {sample.seat}
              </span>
            </div>
          ) : null}

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {fields
              .filter((f) => f.show)
              .map((f) => (
                <div key={f.label} className="flex flex-col gap-1">
                  <dt className={cn("text-xs", label)} style={labelStyle}>
                    {f.label}
                  </dt>
                  {f.badge ? (
                    <dd>
                      <span
                        className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: template.accent,
                          color: accentInk,
                        }}
                      >
                        {f.value}
                      </span>
                    </dd>
                  ) : (
                    <dd className={cn("font-medium", strong)} style={strongStyle}>
                      {f.value}
                    </dd>
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
          <div className="qr-plate shrink-0 rounded-lg bg-white p-2 shadow-sm">
            {sample.qrToken ? (
              /*
                112, not 72.

                The token is 43 base64url characters, which is byte mode and a
                33×33 matrix — 41 modules across once the quiet zone is counted.
                At 72px that is **1.76 CSS px per module**, on the artefact
                people actually screenshot and hold up at a door. Printed it is
                roughly 0.47mm a module, under the practical floor for a cheap
                door scanner, and a messaging app that recompresses the
                screenshot blurs neighbouring modules together.

                112 gives 2.73px per module. The code is the ticket; the note
                beside it can afford the room.
              */
              <TicketQr token={sample.qrToken} size={112} />
            ) : (
              <div
                className="grid grid-cols-7 gap-[2px]"
                aria-label="نمونهٔ کد ورود"
                role="img"
              >
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
            )}
          </div>
          <p className={cn("text-xs leading-relaxed", muted)} style={mutedStyle}>
            {template.note || "این بلیت را هنگام ورود ارائه دهید."}
          </p>
        </div>
      </div>
    </div>
  );
}
