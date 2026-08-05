"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Upload,
  X,
  ImageIcon,
  Download,
  Loader2,
} from "lucide-react";

import { apiFetch, ApiCallError } from "@/lib/client/api";
import { uploadImage } from "@/lib/client/upload";
import { blend, contrastRatio, grade, ticketInk } from "@/lib/contrast";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { downloadNodeAsPng, ticketFileName } from "@/lib/tickets/export";
import {
  TicketPreview,
  type TicketTemplate,
  type TicketSample,
} from "@/components/tickets/TicketPreview";

const ACCENTS = ["#2563EB", "#15803D", "#7C3AED", "#BE123C", "#B45309", "#111111"];

const SAMPLE: TicketSample = {
  eventTitle: "کنسرت همایون شجریان",
  holder: "سارا محمدی",
  category: "وی‌آی‌پی",
  date: "۲۳ مرداد ۱۴۰۵ · ۱۸:۳۰",
  venue: "برج میلاد، تهران",
  // Shown so the organiser lays the ticket out against the version their
  // seated buyers receive, rather than a shorter one that fits more easily.
  seat: "بالکن شرقی · ردیف ب · صندلی ۱۲",
};

const FIELD_TOGGLES: { key: keyof TicketTemplate; label: string }[] = [
  { key: "showDate", label: "نمایش تاریخ" },
  { key: "showVenue", label: "نمایش مکان" },
];

const DEFAULT_TEMPLATE: TicketTemplate = {
  accent: "#2563EB",
  surface: "light",
  bgColor: null,
  bgImage: null,
  logo: null,
  showCategory: false,
  showDate: true,
  showVenue: true,
  note: "این بلیت را هنگام ورود ارائه دهید.",
};

/**
 * Every field optional on the wire, filled in here.
 *
 * A design saved by an older build is missing whatever was added since, and
 * dropping the whole template because one key is absent would lose an
 * organiser's work on every deploy.
 */
function fromStored(design?: Partial<TicketTemplate> | null): TicketTemplate {
  return { ...DEFAULT_TEMPLATE, ...(design ?? {}) };
}

/**
 * Is this design readable?
 *
 * The body text colour comes from `surface`, the background from `bgColor` —
 * two independent controls that can be set to the same darkness. This is the
 * only place that pairing is ever evaluated, because the colours do not exist
 * until an organiser picks them.
 *
 * A background *image* is not graded: its contrast varies pixel to pixel and a
 * single number would be a guess. The preview shows a scrim behind the text for
 * exactly that case, so the honest answer is to say nothing.
 */
function readability(template: TicketTemplate): {
  ratio?: number;
  verdict: ReturnType<typeof grade>;
  skipped: boolean;
} {
  if (template.bgImage) return { verdict: "pass", skipped: true };

  const dark = template.surface === "dark";
  const background = template.bgColor ?? (dark ? "#171717" : "#ffffff");

  /**
   * Grade the *faintest* text, not the boldest.
   *
   * This measured only the headline ink, and so reported «خوانا» for designs
   * whose field labels had already gone. A `#999999` body scores 6.29:1 on the
   * headline — a clean pass — while «دسته», «تاریخ» and «مکان» sit at 1.81:1
   * underneath it. The organiser was told the ticket was fine and shipped it.
   *
   * A check that grades the best-case text is not a lenient check, it is a
   * wrong one: the whole point is to catch what the eye skims past, and the eye
   * skims past small grey labels. So the weakest rank decides the verdict, and
   * it comes from the same `ticketInk` the preview renders with.
   */
  const ink = template.bgColor
    ? ticketInk(background).label
    : dark
      ? blend("#ffffff", background, 0.5) // matches `text-white/50`
      : "#71688d"; //                        matches `text-faint`

  const ratio = contrastRatio(ink, background);
  return { ratio, verdict: grade(ratio), skipped: false };
}

export function TicketDesigner({
  sample = SAMPLE,
  eventId,
  initial,
}: {
  sample?: TicketSample;
  /** Omitted in the creation wizard, where there is no event to save against. */
  eventId?: string;
  initial?: Partial<TicketTemplate> | null;
} = {}) {
  const [template, setTemplate] = useState<TicketTemplate>(() =>
    fromStored(initial),
  );
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Which field is mid-upload, so its control can say so.
  const [uploading, setUploading] = useState<"logo" | "bgImage" | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const bgInput = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const legibility = readability(template);

  async function handleExport() {
    if (!previewRef.current) return;
    setExporting(true);
    setExportError(null);
    try {
      await downloadNodeAsPng(previewRef.current, ticketFileName(sample.eventTitle));
    } catch {
      setExportError("خطا در ساخت تصویر بلیت. دوباره تلاش کنید.");
    } finally {
      setExporting(false);
    }
  }

  const patch = (p: Partial<TicketTemplate>) => {
    setTemplate((t) => ({ ...t, ...p }));
    setSaved(false);
    setSaveError(null);
  };

  /**
   * Persist the template against the event.
   *
   * This button used to set a local boolean and render «ذخیره شد» — it told
   * the organiser their design was saved and then dropped it on reload, and the
   * buyer never saw any of it. Nothing was stored anywhere.
   */
  async function handleSave() {
    if (!eventId) {
      setSaveError("این قالب پس از ساخت رویداد قابل ذخیره است.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await apiFetch(`/api/events/${eventId}`, {
        method: "PATCH",
        body: JSON.stringify({ ticketDesign: template }),
      });
      setSaved(true);
    } catch (e) {
      setSaveError(
        e instanceof ApiCallError ? e.message : "ذخیره قالب ممکن نشد.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    key: "logo" | "bgImage",
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    setUploading(key);
    try {
      /**
       * To Blob, not into the record.
       *
       * These were base64'd into `Event.ticketDesign`, so a logo and a
       * background lived inside the JSONB column — read, parsed and
       * re-serialised on every fetch of the event, and carried in the SSR
       * payload of the public page. What is stored now is a URL.
       */
      const url = await uploadImage(file, "ticket-art");
      patch({ [key]: url } as Partial<TicketTemplate>);
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "بارگذاری تصویر ناموفق بود.",
      );
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-card lg:order-1">
        {/* Brand color */}
        <ControlGroup label="رنگ برند">
          <div className="flex flex-wrap items-center gap-2.5">
            {ACCENTS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => patch({ accent: c })}
                aria-label={`رنگ ${c}`}
                aria-pressed={template.accent === c}
                className={cn(
                  "size-9 rounded-full outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring",
                  template.accent === c
                    ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                    : "hover:scale-105",
                )}
                style={{ backgroundColor: c }}
              />
            ))}
            <label className="relative size-9 cursor-pointer overflow-hidden rounded-full border border-border">
              <span
                className="block size-full"
                style={{ backgroundColor: template.accent }}
              />
              <input
                type="color"
                value={template.accent}
                onChange={(e) => patch({ accent: e.target.value })}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="رنگ برند سفارشی"
              />
            </label>
          </div>
        </ControlGroup>

        {/* Text theme */}
        <ControlGroup label="زمینهٔ متن">
          <div className="grid max-w-xs grid-cols-2 gap-2">
            {(["light", "dark"] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={template.surface === s}
                onClick={() => patch({ surface: s })}
                className={cn(
                  "rounded-md border px-4 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  template.surface === s
                    ? "border-foreground bg-subtle text-foreground"
                    : "border-border text-muted hover:border-border-strong",
                )}
              >
                {s === "light" ? "روشن" : "تیره"}
              </button>
            ))}
          </div>
        </ControlGroup>

        {/* Background */}
        <ControlGroup label="پس‌زمینه">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground">
              <span className="text-muted">رنگ</span>
              <span className="relative size-6 overflow-hidden rounded border border-border">
                <span
                  className="block size-full"
                  style={{ backgroundColor: template.bgColor ?? "#ffffff" }}
                />
                <input
                  type="color"
                  value={template.bgColor ?? "#ffffff"}
                  onChange={(e) => patch({ bgColor: e.target.value })}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label="رنگ پس‌زمینه"
                />
              </span>
            </label>

            <label
              className={cn(
                "inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground",
                uploading === "bgImage"
                  ? "cursor-wait opacity-60"
                  : "cursor-pointer hover:bg-subtle",
              )}
            >
              {uploading === "bgImage" ? (
                <Loader2 className="size-4 animate-spin text-muted" aria-hidden />
              ) : (
                <ImageIcon className="size-4 text-muted" aria-hidden />
              )}
              {uploading === "bgImage" ? "در حال بارگذاری…" : "تصویر پس‌زمینه"}
              <input
                ref={bgInput}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => handleUpload(e, "bgImage")}
                disabled={uploading !== null}
              />
            </label>

            {(template.bgColor || template.bgImage) ? (
              <button
                type="button"
                onClick={() => patch({ bgColor: null, bgImage: null })}
                className="inline-flex items-center gap-1 text-sm text-muted hover:text-danger-text"
              >
                <X className="size-4" aria-hidden />
                حذف پس‌زمینه
              </button>
            ) : null}
          </div>
          {template.bgImage ? (
            <p className="text-xs text-faint">
              تصویر پس‌زمینه اعمال شد. رنگ متن را با «زمینهٔ متن» تنظیم کنید.
            </p>
          ) : null}
        </ControlGroup>

        {/* Logo */}
        <ControlGroup label="لوگو">
          <div className="flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-subtle">
              <Upload className="size-4 text-muted" aria-hidden />
              بارگذاری لوگو
              <input
                ref={logoInput}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => handleUpload(e, "logo")}
                disabled={uploading !== null}
              />
            </label>
            {template.logo ? (
              <button
                type="button"
                onClick={() => patch({ logo: null })}
                className="inline-flex items-center gap-1 text-sm text-muted hover:text-danger-text"
              >
                <X className="size-4" aria-hidden />
                حذف لوگو
              </button>
            ) : null}
          </div>
          {uploadError ? (
            <p className="text-sm text-danger-text">{uploadError}</p>
          ) : null}
        </ControlGroup>

        {/* Field toggles */}
        <ControlGroup label="فیلدهای بلیت">
          <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {FIELD_TOGGLES.map((f) => (
              <ToggleRow
                key={f.key}
                label={f.label}
                checked={Boolean(template[f.key])}
                onChange={(v) => patch({ [f.key]: v } as Partial<TicketTemplate>)}
              />
            ))}
          </div>
        </ControlGroup>

        <div className="p-5">
          <Field id="note" label="یادداشت روی بلیت">
            <Input
              id="note"
              value={template.note}
              onChange={(e) => patch({ note: e.target.value })}
              placeholder="مثلاً: این بلیت را هنگام ورود ارائه دهید."
            />
          </Field>
        </div>

        <div className="flex flex-col gap-2 p-5">
          {!legibility.skipped && legibility.verdict !== "pass" ? (
            // Warn, never block. It is the organiser's brand and they may have
            // a reason; what they must not do is ship an unreadable ticket
            // without being told.
            <p
              role="status"
              className={cn(
                "flex items-start gap-1.5 rounded-lg px-3 py-2 text-xs leading-relaxed",
                legibility.verdict === "fail"
                  ? "bg-danger/10 text-danger-text"
                  : "bg-warning/10 text-warning-text",
              )}
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                {legibility.verdict === "fail"
                  ? "متن روی این پس‌زمینه خوانا نیست"
                  : "متن‌های ریز روی این پس‌زمینه سخت خوانده می‌شوند"}
                {legibility.ratio
                  ? ` (نسبت کنتراست ${formatNumber(legibility.ratio, 1)} از ۴٫۵ لازم).`
                  : "."}{" "}
                رنگ پس‌زمینه یا حالت روشن/تیره را تغییر دهید.
              </span>
            </p>
          ) : null}
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                در حال ذخیره…
              </>
            ) : saved ? (
              <>
                <Check aria-hidden />
                ذخیره شد
              </>
            ) : (
              "ذخیره قالب"
            )}
          </Button>
          {saveError ? (
            <p role="alert" className="text-xs text-danger-text">
              {saveError}
            </p>
          ) : null}
          {saved ? (
            <p className="text-xs text-muted">
              خریداران این رویداد بلیت خود را با همین قالب می‌بینند.
            </p>
          ) : null}
        </div>
      </div>

      <div className="lg:order-2 lg:sticky lg:top-8">
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-subtle/40 p-5 sm:p-6">
          <p className="text-sm font-medium text-muted">پیش‌نمایش زنده</p>
          <div ref={previewRef}>
            <TicketPreview template={template} sample={sample} />
          </div>
          <div className="flex flex-col items-center gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Download aria-hidden />
              )}
              {exporting ? "در حال ساخت تصویر…" : "دانلود بلیت (PNG)"}
            </Button>
            {exportError ? (
              <p className="text-sm text-danger-text">{exportError}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 p-5">
      <h2 className="text-sm font-semibold text-foreground">{label}</h2>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-foreground">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          checked ? "bg-foreground" : "bg-border",
        )}
      >
        <span
          className={cn(
            // Logical start inset + direction-aware transform so the knob
            // travels correctly under both dir=rtl and dir=ltr.
            "absolute top-0.5 start-0.5 size-5 rounded-full bg-background shadow-sm transition-transform",
            checked ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}
