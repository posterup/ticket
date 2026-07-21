"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/** Reset password — mock validation until the auth API lands. */
export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  function submit() {
    const e: Record<string, string> = {};
    if (!current) e.current = "رمز عبور فعلی را وارد کنید.";
    if (next.length < 6) e.next = "رمز جدید حداقل ۶ کاراکتر باشد.";
    if (confirm !== next) e.confirm = "تکرار رمز عبور مطابقت ندارد.";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setDone(true);
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/settings"
          aria-label="بازگشت به تنظیمات"
          className="hidden size-9 place-items-center rounded-full text-muted outline-none transition-colors hover:bg-subtle focus-visible:ring-2 focus-visible:ring-ring/40 lg:grid"
        >
          <ChevronRight className="size-5" aria-hidden />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            تغییر رمز عبور
          </h1>
          <p className="mt-1 text-sm text-muted">رمز عبور حساب خود را به‌روز کنید.</p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onChange={() => setDone(false)}
        className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
      >
        <Field id="current" label="رمز عبور فعلی" error={errors.current}>
          <Input
            id="current"
            type="password"
            dir="ltr"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            aria-invalid={Boolean(errors.current)}
          />
        </Field>
        <Field id="next" label="رمز عبور جدید" error={errors.next}>
          <Input
            id="next"
            type="password"
            dir="ltr"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            aria-invalid={Boolean(errors.next)}
          />
        </Field>
        <Field id="confirm" label="تکرار رمز عبور جدید" error={errors.confirm}>
          <Input
            id="confirm"
            type="password"
            dir="ltr"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={Boolean(errors.confirm)}
          />
        </Field>

        <div className="mt-1 flex items-center gap-3">
          <Button type="submit">به‌روزرسانی رمز عبور</Button>
          {done ? (
            <span className="text-sm text-success">رمز عبور تغییر کرد ✓</span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
