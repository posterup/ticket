"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, ImagePlus } from "lucide-react";

import type { Workspace } from "@/types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const STORAGE_KEY = "poster-active-workspace";

/**
 * Edit the active workspace's public profile: logo (initials), name, bio.
 * Mock save (no backend yet) — mirrors the other composer forms in the app.
 */
export function EditProfileForm({ workspaces }: { workspaces: Workspace[] }) {
  const [active, setActive] = useState<Workspace | undefined>(workspaces[0]);
  const [avatar, setAvatar] = useState(workspaces[0]?.avatar ?? "");
  const [name, setName] = useState(workspaces[0]?.name ?? "");
  const [bio, setBio] = useState(workspaces[0]?.bio ?? "");
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; avatar?: string }>({});

  // Load the active workspace chosen in the profile card.
  useEffect(() => {
    const savedId = localStorage.getItem(STORAGE_KEY);
    const ws = workspaces.find((w) => w.id === savedId) ?? workspaces[0];
    if (!ws) return;
    setActive(ws);
    setAvatar(ws.avatar);
    setName(ws.name);
    setBio(ws.bio ?? "");
  }, [workspaces]);

  if (!active) return null;

  function submit() {
    const next: { name?: string; avatar?: string } = {};
    if (!name.trim()) next.name = "نام الزامی است.";
    if (!avatar.trim()) next.avatar = "حروف لوگو را وارد کنید.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    // Mock persistence until the workspaces API lands.
    setSaved(true);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/profile"
          aria-label="بازگشت به پروفایل"
          className="grid size-9 place-items-center rounded-full text-muted outline-none transition-colors hover:bg-subtle focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <ChevronRight className="size-5" aria-hidden />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            ویرایش پروفایل
          </h1>
          <p className="mt-1 text-sm text-muted">
            لوگو، نام و معرفی فضای کاری شما.
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onChange={() => setSaved(false)}
        className="flex flex-col gap-5 rounded-lg border border-border bg-card p-6"
      >
        {/* Logo / icon */}
        <div className="flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-full bg-foreground text-xl font-bold text-background">
            {avatar.trim() || "؟"}
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">لوگو / آیکون</p>
            <p className="mt-0.5 text-xs text-muted">
              حروف اختصاری (۱ تا ۲ حرف) نمایش داده می‌شود.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled
              className="mt-2"
            >
              <ImagePlus className="size-4" aria-hidden />
              بارگذاری تصویر (به‌زودی)
            </Button>
          </div>
        </div>

        <Field id="avatar" label="حروف لوگو" error={errors.avatar}>
          <Input
            id="avatar"
            value={avatar}
            maxLength={2}
            onChange={(e) => setAvatar(e.target.value)}
            aria-invalid={Boolean(errors.avatar)}
          />
        </Field>

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

        <div className="flex items-center gap-3">
          <Button type="submit">ذخیره تغییرات</Button>
          {saved ? (
            <span className="text-sm text-success">ذخیره شد ✓</span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
