"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PhoneOtpForm } from "@/components/auth/PhoneOtpForm";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { WorkspaceType } from "@/types";

/**
 * Becoming an organizer, in two steps.
 *
 * Step one is the same sign-in every user takes — verifying a code creates the
 * account. Step two creates a workspace, which is the act that actually makes
 * someone a manager. Splitting them is why a normal user can become an
 * organizer later without any role flip.
 */
export function SignupForm() {
  const router = useRouter();
  const [step, setStep] = useState<"identity" | "workspace">("identity");
  const [fullName, setFullName] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [type, setType] = useState<WorkspaceType>("personal");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function createWorkspace() {
    const problems: string[] = [];
    if (!fullName.trim()) problems.push("نام و نام خانوادگی الزامی است.");
    if (!workspace.trim()) problems.push("نام فضای کاری الزامی است.");
    if (problems.length > 0) {
      setError(problems[0]);
      return;
    }

    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          workspaceName: workspace.trim(),
          workspaceType: type,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "ساخت فضای کاری ناموفق بود.");
        return;
      }
      router.replace("/dashboard/events");
      router.refresh();
    } catch {
      setError("ارتباط برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "identity") {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-lg font-bold text-foreground">ساخت حساب</h1>
        <p className="mt-1 text-sm text-muted">
          ابتدا شماره موبایل خود را تأیید کنید.
        </p>

        <PhoneOtpForm
          submitLabel="تأیید و ادامه"
          onVerified={({ isManager }) => {
            // Someone who already has a workspace does not need to make another.
            if (isManager) {
              router.replace("/dashboard/events");
              router.refresh();
              return;
            }
            setStep("workspace");
          }}
        />

        <p className="mt-6 text-center text-sm text-muted">
          حساب دارید؟{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            ورود
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h1 className="text-lg font-bold text-foreground">فضای کاری شما</h1>
      <p className="mt-1 text-sm text-muted">
        رویدادهایتان زیر این صفحه منتشر می‌شوند.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void createWorkspace();
        }}
        className="mt-6 flex flex-col gap-4"
      >
        <Field id="fullName" label="نام و نام خانوادگی">
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </Field>
        <Field
          id="workspace"
          label="نام فضای کاری"
          hint="نام خودتان یا کسب‌وکارتان."
        >
          <Input
            id="workspace"
            value={workspace}
            onChange={(e) => setWorkspace(e.target.value)}
          />
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-foreground">
            نوع فضای کاری
          </legend>
          <div className="flex gap-2">
            {(["personal", "business"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={type === option}
                onClick={() => setType(option)}
                className={cn(
                  "flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
                  type === option
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted hover:text-foreground",
                )}
              >
                {option === "personal" ? "شخصی" : "کسب‌وکار"}
              </button>
            ))}
          </div>
        </fieldset>

        {error ? (
          <p role="alert" className="text-sm text-danger-text">
            {error}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="mt-1" disabled={busy}>
          {busy ? "در حال ساخت…" : "ساخت فضای کاری"}
        </Button>
      </form>
    </div>
  );
}
