"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Link2, Tags, ShieldCheck, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EditButton } from "@/components/dashboard/EditButton";
import { Toggle } from "@/components/create/ui";
import { formatNumber } from "@/lib/format";

type Visibility = "public" | "link" | "audience";

interface TagOption {
  label: string;
  count: number;
}

/** Icon + copy for each visibility mode, shared by the view and edit states. */
const VISIBILITY_META: Record<
  Visibility,
  { icon: typeof Globe; label: string; hint: string }
> = {
  public: {
    icon: Globe,
    label: "عمومی",
    hint: "برای همه قابل مشاهده و خرید است.",
  },
  link: {
    icon: Link2,
    label: "فقط با لینک",
    hint: "فقط افرادی که لینک را دارند می‌توانند ثبت‌نام کنند.",
  },
  audience: {
    icon: Tags,
    label: "بر اساس تگ مخاطب",
    hint: "فقط مخاطبانی که تگ‌های انتخاب‌شده را دارند می‌بینند.",
  },
};

/**
 * Event access & registration settings. Persists the event's visibility
 * (`public` / `link`-only / tag-based `audience`), the allowed CRM tag labels
 * for audience events, and whether registration needs organiser approval.
 *
 * Reads as a compact summary by default; the editable option cards appear only
 * after the organiser taps «ویرایش».
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
  const router = useRouter();
  // Baseline reflects what is persisted; the form stages edits until "save".
  const [saved, setSaved] = useState({
    visibility: initialVisibility,
    approval: initialApproval,
    tags: initialAudienceTags,
  });
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  const [approval, setApproval] = useState(initialApproval);
  const [tags, setTags] = useState<string[]>(initialAudienceTags);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dirty =
    visibility !== saved.visibility ||
    approval !== saved.approval ||
    [...tags].sort().join(" ") !== [...saved.tags].sort().join(" ");

  function toggleTag(label: string) {
    setTags((prev) =>
      prev.includes(label)
        ? prev.filter((t) => t !== label)
        : [...prev, label],
    );
  }

  function cancel() {
    // Discard staged edits and return to the summary.
    setVisibility(saved.visibility);
    setApproval(saved.approval);
    setTags(saved.tags);
    setError("");
    setEditing(false);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visibility,
          requiresApproval: approval,
          audienceTags: tags,
        }),
      });
      if (!res.ok) throw new Error("خطا در ذخیرهٔ تنظیمات دسترسی.");
      setSaved({ visibility, approval, tags });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای ناشناخته رخ داد.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="size-4 text-faint" aria-hidden />
            ثبت‌نام و دسترسی
          </h2>
          <p className="mt-1 text-xs text-muted">
            تعیین کنید چه کسانی می‌توانند در این رویداد ثبت‌نام کنند.
          </p>
        </div>
        {!editing ? (
          <EditButton className="shrink-0" onClick={() => setEditing(true)} />
        ) : null}
      </div>

      {!editing ? (
        <AccessSummary
          visibility={saved.visibility}
          approval={saved.approval}
          tags={saved.tags}
        />
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <AccessOption
              icon={Globe}
              label={VISIBILITY_META.public.label}
              hint={VISIBILITY_META.public.hint}
              active={visibility === "public"}
              onClick={() => setVisibility("public")}
            />
            <AccessOption
              icon={Link2}
              label={VISIBILITY_META.link.label}
              hint={VISIBILITY_META.link.hint}
              active={visibility === "link"}
              onClick={() => setVisibility("link")}
            />
            <AccessOption
              icon={Tags}
              label={VISIBILITY_META.audience.label}
              hint={VISIBILITY_META.audience.hint}
              active={visibility === "audience"}
              onClick={() => setVisibility("audience")}
            />
          </div>

          {visibility === "audience" ? (
            <div className="rounded-lg border border-border bg-subtle p-3">
              <p className="text-xs text-muted">
                تگ‌های مجاز را انتخاب کنید. این رویداد فقط برای مخاطبانی که دست‌کم
                یکی از این تگ‌ها را دارند منتشر می‌شود.
              </p>
              {availableTags.length === 0 ? (
                <p className="mt-3 text-xs text-faint">
                  هنوز هیچ تگی برای مخاطبان تعریف نشده است. ابتدا در بخش مخاطبان
                  تگ بسازید.
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
              onChange={setApproval}
            />
          </div>

          {error ? <p className="text-xs text-danger">{error}</p> : null}

          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={save} disabled={saving || !dirty}>
              <Check aria-hidden />
              {saving ? "در حال ذخیره…" : "ذخیره تغییرات"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={cancel}
              disabled={saving}
            >
              انصراف
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

/** Read-only summary of the persisted access & approval settings. */
function AccessSummary({
  visibility,
  approval,
  tags,
}: {
  visibility: Visibility;
  approval: boolean;
  tags: string[];
}) {
  const meta = VISIBILITY_META[visibility];
  const VisIcon = meta.icon;
  return (
    <dl className="flex flex-col divide-y divide-border rounded-lg border border-border bg-subtle/30">
      <div className="flex items-start gap-2.5 p-4">
        <VisIcon className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden />
        <div className="min-w-0">
          <dt className="text-sm font-medium text-foreground">{meta.label}</dt>
          <dd className="mt-0.5 text-xs text-muted">{meta.hint}</dd>
          {visibility === "audience" && tags.length > 0 ? (
            <dd className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted"
                >
                  {t}
                </span>
              ))}
            </dd>
          ) : null}
        </div>
      </div>
      <div className="flex items-start gap-2.5 p-4">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden />
        <div className="min-w-0">
          <dt className="text-sm font-medium text-foreground">
            {approval ? "ثبت‌نام با تأیید مدیر" : "ثبت‌نام بدون نیاز به تأیید"}
          </dt>
          <dd className="mt-0.5 text-xs text-muted">
            {approval
              ? "هر ثبت‌نام باید پیش از پرداخت توسط شما تأیید شود."
              : "ثبت‌نام‌ها بدون بررسی نهایی انجام می‌شوند."}
          </dd>
        </div>
      </div>
    </dl>
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
