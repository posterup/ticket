"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export interface VerifiedSession {
  isNewUser: boolean;
  isManager: boolean;
}

interface Props {
  /** Called once the code is accepted and the session cookie is set. */
  onVerified: (session: VerifiedSession) => void;
  submitLabel?: string;
}

interface ApiError {
  error: { message: string; code: string };
}

function messageOf(json: unknown, fallback: string): string {
  const error = (json as ApiError | undefined)?.error;
  return error?.message ?? fallback;
}

/**
 * Phone → one-time code, the single sign-in path for both roles.
 *
 * Login and signup share this: verifying a code creates the account if it is
 * new, so the only difference is where the caller goes next.
 */
export function PhoneOtpForm({ onVerified, submitLabel = "ورود" }: Props) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  // Countdown for the resend link.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  async function requestCode() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(messageOf(json, "ارسال کد ناموفق بود."));
        return;
      }
      setStep("code");
      setResendIn(json.data?.resendAfterSec ?? 60);
      // Outside production the gateway is optional and the code comes back in
      // the response, so development needs no SMS credentials.
      if (json.data?.devCode) setCode(json.data.devCode);
    } catch {
      setError("ارتباط برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), code: code.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(messageOf(json, "کد پذیرفته نشد."));
        return;
      }
      onVerified(json.data as VerifiedSession);
    } catch {
      setError("ارتباط برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (step === "phone") void requestCode();
        else void verify();
      }}
      className="mt-6 flex flex-col gap-4"
    >
      <Field
        id="phone"
        label="شماره موبایل"
        hint={step === "code" ? undefined : "کد ورود برایتان پیامک می‌شود."}
      >
        <Input
          id="phone"
          dir="ltr"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          disabled={step === "code"}
          onChange={(e) => setPhone(e.target.value)}
        />
      </Field>

      {step === "code" ? (
        <Field id="code" label="کد تأیید" error={error}>
          <Input
            id="code"
            ref={codeRef}
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
        </Field>
      ) : error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="mt-1" disabled={busy}>
        {busy ? "لطفاً صبر کنید…" : step === "phone" ? "دریافت کد" : submitLabel}
      </Button>

      {step === "code" ? (
        <div className="flex items-center justify-between text-sm text-muted">
          <button
            type="button"
            className="underline-offset-4 hover:text-foreground hover:underline"
            onClick={() => {
              setStep("phone");
              setCode("");
              setError("");
            }}
          >
            تغییر شماره
          </button>
          <button
            type="button"
            disabled={resendIn > 0 || busy}
            className="underline-offset-4 hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void requestCode()}
          >
            {resendIn > 0 ? `ارسال دوباره تا ${resendIn} ثانیه` : "ارسال دوباره کد"}
          </button>
        </div>
      ) : null}
    </form>
  );
}
