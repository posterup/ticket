import type { Metadata } from "next";
import Link from "next/link";
import {
  KeyRound,
  Bell,
  Palette,
  ChevronLeft,
  type LucideIcon,
} from "lucide-react";

export const metadata: Metadata = { title: "تنظیمات | پوستر" };

interface SettingRow {
  href?: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  soon?: boolean;
}

const ROWS: SettingRow[] = [
  {
    href: "/dashboard/settings/password",
    label: "تغییر رمز عبور",
    hint: "رمز عبور حساب خود را به‌روزرسانی کنید.",
    icon: KeyRound,
  },
  {
    label: "اعلان‌ها",
    hint: "تنظیمات اعلان‌های ایمیل و پیامک.",
    icon: Bell,
    soon: true,
  },
  {
    label: "ظاهر",
    hint: "حالت روشن/تیره و زبان.",
    icon: Palette,
    soon: true,
  },
];

export default function SettingsPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/profile"
          aria-label="بازگشت به پروفایل"
          className="grid size-9 place-items-center rounded-full text-muted outline-none transition-colors hover:bg-subtle focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <ChevronLeft className="size-5 rotate-180" aria-hidden />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            تنظیمات
          </h1>
          <p className="mt-1 text-sm text-muted">مدیریت حساب و ترجیحات شما.</p>
        </div>
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {ROWS.map((row) => {
          const Icon = row.icon;
          const body = (
            <>
              <Icon className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
              <span className="flex-1">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {row.label}
                  {row.soon ? (
                    <span className="rounded-full border border-border bg-subtle px-2 py-0.5 text-[0.625rem] text-faint">
                      به‌زودی
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-xs text-muted">{row.hint}</span>
              </span>
              {row.href ? (
                <ChevronLeft className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden />
              ) : null}
            </>
          );

          return row.href ? (
            <Link
              key={row.label}
              href={row.href}
              className="flex items-start gap-3 px-5 py-4 outline-none transition-colors hover:bg-subtle focus-visible:bg-subtle"
            >
              {body}
            </Link>
          ) : (
            <div
              key={row.label}
              className="flex items-start gap-3 px-5 py-4 opacity-70"
            >
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
