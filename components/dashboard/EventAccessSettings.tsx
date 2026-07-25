"use client";

import { useState } from "react";
import { Globe, Link2, Tags, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { Toggle } from "@/components/create/ui";
import { formatNumber } from "@/lib/format";

type Visibility = "public" | "link" | "audience";

interface TagOption {
  label: string;
  count: number;
}

/**
 * Event access & registration settings. Persists the event's visibility
 * (`public` / `link`-only / tag-based `audience`), the allowed CRM tag labels
 * for audience events, and whether registration needs organiser approval.
 */
export function EventAccessSettings({
  eventId,
  visibility: initialVisibility = "public",
  requiresApproval: initialApproval = false,
  audienceTags: initialAudienceTags = [],
  availableTags = [],
}: {
  eventId: string;
  visibility?: Visibility;
  requiresApproval?: boolean;
  audienceTags?: string[];
  availableTags?: TagOption[];
}) {
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  const [approval, setApproval] = useState(initialApproval);
  const [tags, setTags] = useState<string[]>(initialAudienceTags);

  function patch(body: Record<string, unknown>) {
    void fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function changeVisibility(next: Visibility) {
    setVisibility(next);
    patch({ visibility: next });
  }

  function changeApproval(next: boolean) {
    setApproval(next);
    patch({ requiresApproval: next });
  }

  function toggleTag(label: string) {
    const next = tags.includes(label)
      ? tags.filter((t) => t !== label)
      : [...tags, label];
    setTags(next);
    patch({ audienceTags: next });
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShieldCheck className="size-4 text-faint" aria-hidden />
          ثبت‌نام و دسترسی
        </h2>
        <p className="mt-1 text-xs text-muted">
          تعیین کنید چه کسانی می‌توانند در این رویداد ثبت‌نام کنند.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <AccessOption
          icon={Globe}
          label="عمومی"
          hint="برای همه قابل مشاهده و خرید است."
          active={visibility === "public"}
          onClick={() => changeVisibility("public")}
        />
        <AccessOption
          icon={Link2}
          label="فقط با لینک"
          hint="فقط افرادی که لینک را دارند می‌توانند ثبت‌نام کنند."
          active={visibility === "link"}
          onClick={() => changeVisibility("link")}
        />
        <AccessOption
          icon={Tags}
          label="بر اساس تگ مخاطب"
          hint="فقط مخاطبانی که تگ‌های انتخاب‌شده را دارند می‌بینند."
          active={visibility === "audience"}
          onClick={() => changeVisibility("audience")}
        />
      </div>

      {visibility === "audience" ? (
        <div className="rounded-lg border border-border bg-subtle p-3">
          <p className="text-xs text-muted">
            تگ‌های مجاز را انتخاب کنید. این رویداد فقط برای مخاطبانی که دست‌کم یکی
            از این تگ‌ها را دارند منتشر می‌شود.
          </p>
          {availableTags.length === 0 ? (
            <p className="mt-3 text-xs text-faint">
              هنوز هیچ تگی برای مخاطبان تعریف نشده است. ابتدا در بخش مخاطبان تگ
              بسازید.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {availableTags.map((t) => {
                const active = tags.includes(t.label);
                return (
                  <button
                    key={t.label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleTag(t.label)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted hover:border-border-strong hover:text-foreground",
                    )}
                  >
                    {t.label}
                    <span
                      className={cn(
                        "text-[10px]",
                        active ? "text-background/70" : "text-faint",
                      )}
                    >
                      {formatNumber(t.count)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      <div className="border-t border-border pt-4">
        <Toggle
          label="پذیرش با تأیید مدیر (فقط مهمانان تأییدشده)"
          hint="در هر دو حالت عمومی و خصوصی؛ ثبت‌نام هر فرد باید پیش از پرداخت توسط شما تأیید شود."
          checked={approval}
          onChange={changeApproval}
        />
      </div>
    </section>
  );
}

function AccessOption({
  icon: Icon,
  label,
  hint,
  active,
  onClick,
}: {
  icon: typeof Globe;
  label: string;
  hint: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-lg border p-3 text-start outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
        active
          ? "border-foreground bg-subtle"
          : "border-border hover:border-border-strong",
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Icon className="size-4" aria-hidden />
        {label}
      </span>
      <span className="text-xs text-muted">{hint}</span>
    </button>
  );
}
