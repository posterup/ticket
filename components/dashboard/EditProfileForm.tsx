"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ImagePlus, X } from "lucide-react";

import type { Workspace } from "@/types";
import { ApiCallError, apiFetch } from "@/lib/client/api";
import { uploadImage } from "@/lib/client/upload";
import { useWorkspaceSwitcher } from "@/components/dashboard/ActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceBanner } from "@/components/workspace/WorkspaceBanner";
import { WorkspaceAvatar } from "@/components/workspace/WorkspaceAvatar";

/**
 * Edit the active workspace's public profile: logo, banner, name, bio.
 *
 * This was a mock — it validated, set a boolean and rendered «ذخیره شد» while
 * persisting nothing, and both image buttons were disabled «به‌زودی». It now
 * uploads to Blob and saves through `PATCH /api/workspaces/:slug`.
 *
 * Which workspace it edits comes from {@link useWorkspaceSwitcher}, the same
 * cookie-backed choice the rest of the dashboard reads. It used to read a
 * `localStorage` key the switcher had stopped writing, so on a fresh browser it
 * edited whichever workspace happened to be first.
 */
export function EditProfileForm() {
  const router = useRouter();
  const { active } = useWorkspaceSwitcher();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  // `null` is a real value here — «حذف تصویر» — so it cannot be `undefined`.
  const [avatar, setAvatar] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"avatar" | "banner" | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ name?: string }>({});

  // Seed the fields once the shell has resolved the active workspace, and
  // again if the reader switches to another one from the profile card.
  const activeId = active?.id;
  useEffect(() => {
    if (!active) return;
    setName(active.name);
    setBio(active.bio ?? "");
    setAvatar(active.avatar ?? null);
    setBanner(active.banner ?? null);
    // Keyed on the id: re-running on every `active` identity change would undo
    // the reader's typing each time the shell re-rendered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  if (!active) return null;
  const workspace = active;

  async function pick(
    kind: "avatar" | "banner",
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFailure(null);
    setSaved(false);
    setUploading(kind);
    try {
      const url = await uploadImage(file, "workspace");
      if (kind === "avatar") setAvatar(url);
      else setBanner(url);
    } catch (error) {
      setFailure(
        error instanceof Error ? error.message : "بارگذاری ناموفق بود.",
      );
    } finally {
      setUploading(null);
    }
  }

  async function submit() {
    const next: { name?: string } = {};
    if (!name.trim()) next.name = "نام الزامی است.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    setFailure(null);
    try {
      await apiFetch<Workspace>(`/api/workspaces/${workspace.slug}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          bio: bio.trim() || null,
          avatar,
          banner,
        }),
      });
      setSaved(true);
      // The shell loaded these workspaces server-side; without this the
      // switcher and the profile card keep the old name until a full reload.
      router.refresh();
    } catch (error) {
      setFailure(
        error instanceof ApiCallError ? error.message : "ذخیره ممکن نشد.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      {/* Desktop-only back link — on mobile the shell's header carries the
          page title and a back control. */}
      <Link
        href="/dashboard/profile"
        aria-label="بازگشت به پروفایل"
        className="hidden size-9 place-items-center rounded-full text-muted outline-none transition-colors hover:bg-subtle focus-visible:ring-2 focus-visible:ring-ring lg:grid"
      >
        <ChevronRight className="size-5" aria-hidden />
      </Link>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        onChange={() => setSaved(false)}
        className="flex flex-col gap-5 rounded-lg border border-border bg-card p-6"
      >
        {/* Banner */}
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">بنر</p>
            <div className="flex items-center gap-1">
              {banner ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setBanner(null)}
                >
                  <X className="size-4" aria-hidden />
                  حذف
                </Button>
              ) : null}
              <label
                className={buttonLabel}
                aria-disabled={uploading !== null || undefined}
              >
                <ImagePlus className="size-4" aria-hidden />
                {uploading === "banner" ? "در حال بارگذاری…" : "بارگذاری بنر"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={uploading !== null}
                  onChange={(e) => void pick("banner", e)}
                />
              </label>
            </div>
          </div>
          <WorkspaceBanner
            seed={workspace.slug}
            banner={banner ?? undefined}
            className="mt-2 h-28 w-full rounded-lg border border-border"
          />
        </div>

        {/* Logo. There is no initials field: the workspace has a logo image or
            it has the default icon, and nothing in between. */}
        <div className="flex items-center gap-4">
          <WorkspaceAvatar
            src={avatar ?? undefined}
            className="size-16 rounded-full"
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">لوگو</p>
            <p className="mt-0.5 text-xs text-muted">
              تا زمانی که تصویری بارگذاری نشده، آیکون پیش‌فرض نمایش داده می‌شود.
            </p>
            <div className="mt-2 flex items-center gap-1">
              <label
                className={buttonLabel}
                aria-disabled={uploading !== null || undefined}
              >
                <ImagePlus className="size-4" aria-hidden />
                {uploading === "avatar" ? "در حال بارگذاری…" : "بارگذاری تصویر"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={uploading !== null}
                  onChange={(e) => void pick("avatar", e)}
                />
              </label>
              {avatar ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAvatar(null)}
                >
                  <X className="size-4" aria-hidden />
                  حذف
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <Field id="name" label="نام" error={errors.name}>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(errors.name)}
          />
        </Field>

        <Field id="bio" label="معرفی">
          <Textarea
            id="bio"
            value={bio}
            rows={3}
            onChange={(e) => setBio(e.target.value)}
            placeholder="یک معرفی کوتاه از فضای کاری شما."
          />
        </Field>

        {failure ? (
          <p
            role="alert"
            className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger-text"
          >
            {failure}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving || uploading !== null}>
            {saving ? "در حال ذخیره…" : "ذخیره تغییرات"}
          </Button>
          {saved ? (
            <span className="text-sm text-success-text">ذخیره شد ✓</span>
          ) : null}
        </div>
      </form>
    </div>
  );
}

/**
 * A `<label>` wrapping a file input, dressed as a secondary button.
 *
 * A `<button>` cannot open a file picker without JavaScript reaching for the
 * input, and the label does it natively — so the control stays a real one.
 */
const buttonLabel =
  "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-subtle focus-within:ring-2 focus-within:ring-ring aria-disabled:pointer-events-none aria-disabled:opacity-50";
