"use client";

import { Upload, X, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Disclosure } from "@/components/create/ui";
import {
  TicketPreview,
  type TicketTemplate,
  type TicketSample,
} from "@/components/tickets/TicketPreview";
import { defaultTicketDesign } from "@/lib/create/types";

const ACCENTS = ["#111111", "#2563EB", "#15803D", "#7C3AED", "#BE123C", "#B45309"];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Optional ticket-appearance designer inside the composer (step 3). A subset of
 * the full dashboard designer: brand color, text theme, logo, and note, with a
 * live preview. `null` design means the default look.
 */
export function TicketDesignSection({
  design,
  sample,
  onChange,
}: {
  design: TicketTemplate | null;
  sample: TicketSample;
  onChange: (design: TicketTemplate | null) => void;
}) {
  const t = design;

  const patch = (p: Partial<TicketTemplate>) => {
    if (t) onChange({ ...t, ...p });
  };

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) return;
    patch({ logo: await readFileAsDataUrl(file) });
  }

  return (
    <Disclosure
      label="طراحی ظاهر بلیت (اختیاری)"
      onOpenChange={(open) => {
        if (open && !design) onChange(defaultTicketDesign());
      }}
    >
      {t ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">رنگ برند</span>
              <div className="flex flex-wrap items-center gap-2.5">
                {ACCENTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => patch({ accent: c })}
                    aria-label={`رنگ ${c}`}
                    aria-pressed={t.accent === c}
                    className={cn(
                      "size-8 rounded-full outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring/40",
                      t.accent === c
                        ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                        : "hover:scale-105",
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <label className="relative size-8 cursor-pointer overflow-hidden rounded-full border border-border">
                  <span className="block size-full" style={{ backgroundColor: t.accent }} />
                  <input
                    type="color"
                    value={t.accent}
                    onChange={(e) => patch({ accent: e.target.value })}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="رنگ برند سفارشی"
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">زمینهٔ متن</span>
              <div className="grid max-w-xs grid-cols-2 gap-2">
                {(["light", "dark"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={t.surface === s}
                    onClick={() => patch({ surface: s })}
                    className={cn(
                      "rounded-md border px-4 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/15",
                      t.surface === s
                        ? "border-foreground bg-subtle text-foreground"
                        : "border-border text-muted hover:border-border-strong",
                    )}
                  >
                    {s === "light" ? "روشن" : "تیره"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">لوگو</span>
              <div className="flex items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-subtle">
                  <Upload className="size-4 text-muted" aria-hidden />
                  بارگذاری لوگو
                  <input type="file" accept="image/*" className="sr-only" onChange={handleLogo} />
                </label>
                {t.logo ? (
                  <button
                    type="button"
                    onClick={() => patch({ logo: null })}
                    className="inline-flex items-center gap-1 text-sm text-muted hover:text-danger"
                  >
                    <X className="size-4" aria-hidden />
                    حذف
                  </button>
                ) : null}
              </div>
            </div>

            <Field id="ticket-note" label="یادداشت روی بلیت">
              <Input
                id="ticket-note"
                value={t.note}
                onChange={(e) => patch({ note: e.target.value })}
              />
            </Field>

            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-foreground"
            >
              <RotateCcw className="size-4" aria-hidden />
              بازگشت به طرح پیش‌فرض
            </button>
          </div>

          <div>
            <p className="mb-3 text-sm font-medium text-muted">پیش‌نمایش بلیت</p>
            <TicketPreview template={t} sample={sample} />
          </div>
        </div>
      ) : null}
    </Disclosure>
  );
}
