"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { setLoggedIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ id?: string; pw?: string }>({});

  function submit() {
    const next: { id?: string; pw?: string } = {};
    if (!identifier.trim()) next.id = "شماره موبایل را وارد کنید.";
    if (!password) next.pw = "رمز عبور را وارد کنید.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    // Mock auth: flip the logged-in flag, then enter the dashboard.
    setLoggedIn();
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h1 className="text-lg font-bold text-foreground">ورود به حساب</h1>
      <p className="mt-1 text-sm text-muted">به داشبورد پوستر وارد شوید.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-6 flex flex-col gap-4"
      >
        <Field id="identifier" label="شماره موبایل" error={errors.id}>
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
        <Button type="submit" size="lg" className="mt-1">
          ورود
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        حساب ندارید؟{" "}
        <Link
          href="/signup"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          ثبت‌نام
        </Link>
      </p>
    </div>
  );
}
