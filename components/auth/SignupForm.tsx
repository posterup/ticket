"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type WorkspaceType = "personal" | "business";

export function SignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [type, setType] = useState<WorkspaceType>("business");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit() {
    const next: Record<string, string> = {};
    if (!fullName.trim()) next.name = "نام و نام خانوادگی الزامی است.";
    if (!identifier.trim()) next.id = "ایمیل یا شماره موبایل را وارد کنید.";
    if (password.length < 6) next.pw = "رمز عبور حداقل ۶ کاراکتر باشد.";
    if (!workspace.trim()) next.ws = "نام فضای کاری الزامی است.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    router.push("/dashboard");
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h1 className="text-lg font-bold text-foreground">ساخت حساب</h1>
      <p className="mt-1 text-sm text-muted">
        حساب و اولین فضای کاری خود را بسازید.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-6 flex flex-col gap-4"
      >
        <Field id="fullName" label="نام و نام خانوادگی" error={errors.name}>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            aria-invalid={Boolean(errors.name)}
          />
        </Field>
        <Field id="identifier" label="ایمیل یا شماره موبایل" error={errors.id}>
          <Input
            id="identifier"
            dir="ltr"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            aria-invalid={Boolean(errors.id)}
          />
        </Field>
        <Field id="password" label="رمز عبور" error={errors.pw}>
          <Input
            id="password"
            type="password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(errors.pw)}
          />
        </Field>

        <Field id="workspace" label="نام فضای کاری" error={errors.ws}>
          <Input
            id="workspace"
            value={workspace}
            onChange={(e) => setWorkspace(e.target.value)}
            placeholder="مثلاً استودیو رویداد آوا"
            aria-invalid={Boolean(errors.ws)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: "personal", label: "شخصی" },
              { value: "business", label: "کسب‌وکار" },
            ] as const
          ).map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={type === t.value}
              onClick={() => setType(t.value)}
              className={cn(
                "rounded-md border px-3 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/15",
                type === t.value
                  ? "border-foreground bg-subtle text-foreground"
                  : "border-border text-muted hover:border-border-strong",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Button type="submit" size="lg" className="mt-1">
          ساخت حساب
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        قبلاً ثبت‌نام کرده‌اید؟{" "}
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
