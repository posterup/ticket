"use client";

import { useState } from "react";
import { Globe, Link2, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { Toggle } from "@/components/create/ui";

type Visibility = "public" | "link";

/**
 * Event access & registration settings (tickets tab). Persists the event's
 * visibility (`public` / `link`-only) and, for link events, whether
 * registration needs organiser approval ("accept-only").
 */
export function EventAccessSettings({
  eventId,
  visibility: initialVisibility = "public",
  requiresApproval: initialApproval = false,
}: {
  eventId: string;
  visibility?: Visibility;
  requiresApproval?: boolean;
}) {
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  const [approval, setApproval] = useState(initialApproval);

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

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShieldCheck className="size-4 text-faint" aria-hidden />
          ثبت‌نام و دسترسی
        </h2>
        <p className="mt-1 text-xs text-muted">
          تعیین کنید چه کسانی می‌توانند در این رویداد ثبت‌نام کنند.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
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
      </div>

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
