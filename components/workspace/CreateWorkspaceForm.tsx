"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { apiFetch, ApiCallError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type WorkspaceType = "personal" | "business";

const TYPES: { value: WorkspaceType; title: string; desc: string; icon: typeof User }[] =
  [
    { value: "personal", title: "شخصی", desc: "صفحهٔ شخصی شما", icon: User },
    {
      value: "business",
      title: "کسب‌وکار",
      desc: "صفحهٔ سازمان یا برند",
      icon: Building2,
    },
  ];

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<WorkspaceType>("business");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  /**
   * Actually create it.
   *
   * This was `router.push("/dashboard/events")` under a comment reading "Mock
   * create". It created nothing — and the navigation sent a person who still
   * had no workspace to a dashboard that refuses people with no workspace,
   * which bounced them to `/me`. The button appeared to do nothing at all.
   */
  async function submit() {
    if (busy) return;
    if (!name.trim()) {
      setError("نام فضای کاری الزامی است.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiFetch("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          type,
          ...(bio.trim() ? { bio: bio.trim() } : {}),
        }),
      });
      /*
        A full navigation, not `router.push`. The session's membership is what
        the dashboard layout and the nav both read, and it was fetched before
        this workspace existed — a client-side push would arrive at the
        dashboard with a cached "not a manager" and bounce straight back out.
      */
      window.location.assign("/dashboard/events");
    } catch (e) {
      setError(
        e instanceof ApiCallError ? e.message : "ساخت فضای کاری انجام نشد. دوباره تلاش کنید.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-6 rounded-lg border border-border bg-card p-6">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">نوع فضای کاری</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {TYPES.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.value}
                type="button"
                aria-pressed={type === t.value}
                onClick={() => setType(t.value)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 text-start outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  type === t.value
                    ? "border-foreground bg-subtle"
                    : "border-border hover:border-border-strong",
                )}
              >
                <Icon className="mt-0.5 size-5 text-muted" aria-hidden />
                <span>
                  <span className="block text-sm font-semibold text-foreground">
                    {t.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {t.desc}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Field id="ws-name" label="نام فضای کاری" required error={error}>
        <Input
          id="ws-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          placeholder="مثلاً استودیو رویداد آوا"
          aria-invalid={Boolean(error)}
        />
      </Field>

      <Field id="ws-bio" label="معرفی (اختیاری)">
        <Textarea
          id="ws-bio"
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="یک توضیح کوتاه دربارهٔ فضای کاری"
        />
      </Field>

      <div className="flex gap-3">
        <Button type="button" onClick={submit} disabled={busy}>
          {busy ? "در حال ساخت…" : "ساخت فضای کاری"}
        </Button>
        {/* Back to where they came from, which for someone with no workspace
            is `/me` and not a dashboard that would refuse them. */}
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => router.push("/me")}
        >
          انصراف
        </Button>
      </div>
    </div>
  );
}
