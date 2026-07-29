"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { PhoneOtpForm } from "@/components/auth/PhoneOtpForm";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h1 className="text-lg font-bold text-foreground">ورود به حساب</h1>
      <p className="mt-1 text-sm text-muted">
        با شماره موبایل خود وارد شوید؛ رمز عبوری در کار نیست.
      </p>

      <PhoneOtpForm
        onVerified={({ isManager }) => {
          // Back to wherever they were headed, else the surface that fits
          // them: the dashboard for organizers, «من» for everyone else.
          const requested = searchParams.get("next");
          const dest =
            requested && requested.startsWith("/")
              ? requested
              : isManager
                ? "/dashboard/events"
                : "/me";
          router.replace(dest);
          router.refresh();
        }}
      />

      <p className="mt-6 text-center text-sm text-muted">
        برگزارکننده‌اید؟{" "}
        <Link
          href="/signup"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          فضای کاری بسازید
        </Link>
      </p>
    </div>
  );
}
