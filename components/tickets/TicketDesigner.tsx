"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  TicketPreview,
  type TicketTemplate,
  type TicketSample,
} from "@/components/tickets/TicketPreview";

const ACCENTS: { name: string; value: string }[] = [
  { name: "آبی", value: "#2563EB" },
  { name: "سبز", value: "#15803D" },
  { name: "بنفش", value: "#7C3AED" },
  { name: "صورتی", value: "#BE123C" },
  { name: "کهربایی", value: "#B45309" },
  { name: "مشکی", value: "#111111" },
];

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

export function TicketDesigner() {
  const [template, setTemplate] = useState<TicketTemplate>({
    accent: "#2563EB",
    theme: "light",
    showCategory: true,
    showSeat: true,
    showDate: true,
    showVenue: true,
    note: "این بلیت را هنگام ورود ارائه دهید.",
  });
  const [saved, setSaved] = useState(false);

  const patch = (p: Partial<TicketTemplate>) => {
    setTemplate((t) => ({ ...t, ...p }));
    setSaved(false);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Controls */}
      <div className="flex flex-col gap-6 lg:order-1">
        <ControlGroup label="رنگ برند">
          <div className="flex flex-wrap gap-2.5">
            {ACCENTS.map((a) => (
              <button
                key={a.value}
                type="button"
                onClick={() => patch({ accent: a.value })}
                aria-label={a.name}
                aria-pressed={template.accent === a.value}
                className={cn(
                  "size-9 rounded-full outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring/40",
                  template.accent === a.value
                    ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                    : "hover:scale-105",
                )}
                style={{ backgroundColor: a.value }}
              />
            ))}
          </div>
        </ControlGroup>

        <ControlGroup label="زمینه">
          <div className="grid max-w-xs grid-cols-2 gap-2">
            {(["light", "dark"] as const).map((theme) => (
              <button
                key={theme}
                type="button"
                aria-pressed={template.theme === theme}
                onClick={() => patch({ theme })}
                className={cn(
                  "rounded-md border px-4 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/15",
                  template.theme === theme
                    ? "border-foreground bg-subtle text-foreground"
                    : "border-border text-muted hover:border-border-strong",
                )}
              >
                {theme === "light" ? "روشن" : "تیره"}
              </button>
            ))}
          </div>
        </ControlGroup>

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

      {/* Preview */}
      <div className="lg:order-2">
        <div className="lg:sticky lg:top-8">
          <p className="mb-4 text-sm font-medium text-muted">پیش‌نمایش زنده</p>
          <TicketPreview template={template} sample={SAMPLE} />
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
            "inline-block size-5 rounded-full bg-background shadow-sm transition-transform",
            checked ? "translate-x-0.5" : "translate-x-[1.375rem]",
          )}
        />
      </button>
    </div>
  );
}
