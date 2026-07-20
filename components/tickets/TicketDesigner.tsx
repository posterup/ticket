"use client";

import { useRef, useState } from "react";
import { Check, Upload, X, ImageIcon, Download, Loader2 } from "lucide-react";

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
  seat: "ردیف A · صندلی ۱۲",
  date: "۲۳ مرداد ۱۴۰۵ · ۱۸:۳۰",
  venue: "برج میلاد، تهران",
};

const FIELD_TOGGLES: { key: keyof TicketTemplate; label: string }[] = [
  { key: "showCategory", label: "نمایش دسته بلیت" },
  { key: "showSeat", label: "نمایش جایگاه" },
  { key: "showDate", label: "نمایش تاریخ" },
  { key: "showVenue", label: "نمایش مکان" },
];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function TicketDesigner({ sample = SAMPLE }: { sample?: TicketSample } = {}) {
  const [template, setTemplate] = useState<TicketTemplate>({
    accent: "#2563EB",
    surface: "light",
    bgColor: null,
    bgImage: null,
    logo: null,
    showCategory: true,
    showSeat: true,
    showDate: true,
    showVenue: true,
    note: "این بلیت را هنگام ورود ارائه دهید.",
  });
  const [saved, setSaved] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const bgInput = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

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
  };

  async function handleUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    key: "logo" | "bgImage",
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("فقط فایل تصویری مجاز است.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("حجم تصویر باید کمتر از ۲ مگابایت باشد.");
      return;
    }
    setUploadError(null);
    patch({ [key]: await readFileAsDataUrl(file) } as Partial<TicketTemplate>);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="flex flex-col gap-6 lg:order-1">
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
                  "size-9 rounded-full outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring/40",
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
                  "rounded-md border px-4 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/15",
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

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-subtle">
              <ImageIcon className="size-4 text-muted" aria-hidden />
              تصویر پس‌زمینه
              <input
                ref={bgInput}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => handleUpload(e, "bgImage")}
              />
            </label>

            {(template.bgColor || template.bgImage) ? (
              <button
                type="button"
                onClick={() => patch({ bgColor: null, bgImage: null })}
                className="inline-flex items-center gap-1 text-sm text-muted hover:text-danger"
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
              />
            </label>
            {template.logo ? (
              <button
                type="button"
                onClick={() => patch({ logo: null })}
                className="inline-flex items-center gap-1 text-sm text-muted hover:text-danger"
              >
                <X className="size-4" aria-hidden />
                حذف لوگو
              </button>
            ) : null}
          </div>
        </ControlGroup>

        {uploadError ? (
          <p className="text-sm text-danger">{uploadError}</p>
        ) : null}

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

        <Field id="note" label="یادداشت روی بلیت">
          <Input
            id="note"
            value={template.note}
            onChange={(e) => patch({ note: e.target.value })}
            placeholder="مثلاً: این بلیت را هنگام ورود ارائه دهید."
          />
        </Field>

        <div>
          <Button type="button" onClick={() => setSaved(true)}>
            {saved ? (
              <>
                <Check aria-hidden />
                ذخیره شد
              </>
            ) : (
              "ذخیره قالب"
            )}
          </Button>
        </div>
      </div>

      <div className="lg:order-2">
        <div className="lg:sticky lg:top-8">
          <p className="mb-4 text-sm font-medium text-muted">پیش‌نمایش زنده</p>
          <div ref={previewRef}>
            <TicketPreview template={template} sample={sample} />
          </div>
          <div className="mt-5 flex flex-col items-center gap-2">
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
              <p className="text-sm text-danger">{exportError}</p>
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
    <div className="flex flex-col gap-3">
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
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
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
