import type { Metadata } from "next";
import { Wallet, Receipt, Landmark, Clock } from "lucide-react";

import { computeFinance } from "@/lib/finance/compute";
import { formatToman, formatJalaliDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "مالی | پوستر" };

export default function FinancePage() {
  const f = computeFinance();

  const kpis = [
    { label: "درآمد ناخالص", value: formatToman(f.gross), icon: Wallet },
    { label: "کارمزد پلتفرم (۳٪)", value: formatToman(f.fee), icon: Receipt },
    { label: "خالص قابل تسویه", value: formatToman(f.net), icon: Landmark },
    { label: "در انتظار تسویه", value: formatToman(f.pendingSettlement), icon: Clock },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            مالی
          </h1>
          <p className="mt-1 text-sm text-muted">
            درآمد، تسویه‌حساب‌ها و تراکنش‌های رویدادهای شما.
          </p>
        </div>
        <span className="rounded-full border border-border bg-subtle px-2.5 py-1 text-xs text-muted">
          داده‌های نمونه
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-lg border border-border bg-card p-5">
              <Icon className="size-5 text-faint" aria-hidden />
              <div className="mt-3 text-lg font-bold text-foreground">
                {k.value}
              </div>
              <div className="mt-1 text-sm text-muted">{k.label}</div>
            </div>
          );
        })}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">تسویه‌حساب‌ها</h2>
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {f.settlements.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {formatToman(s.amount)}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {formatJalaliDate(s.date)}
                </p>
              </div>
              <StatusPill
                label={s.status === "paid" ? "واریز شد" : "در انتظار"}
                tone={s.status === "paid" ? "success" : "warning"}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">تراکنش‌های اخیر</h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-start text-sm">
            <thead>
              <tr className="border-b border-border bg-subtle text-xs text-muted">
                <th className="px-5 py-3 text-start font-medium">خریدار</th>
                <th className="px-5 py-3 text-start font-medium">رویداد</th>
                <th className="px-5 py-3 text-start font-medium">مبلغ</th>
                <th className="px-5 py-3 text-start font-medium">وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {f.transactions.map((t) => (
                <tr key={t.id}>
                  <td className="px-5 py-3.5 font-medium text-foreground">
                    {t.buyer}
                  </td>
                  <td className="px-5 py-3.5 text-muted">{t.event}</td>
                  <td className="px-5 py-3.5 text-foreground">
                    {formatToman(t.amount)}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusPill
                      label={t.status === "paid" ? "پرداخت‌شده" : "مسترد"}
                      tone={t.status === "paid" ? "success" : "danger"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "warning" | "danger";
}) {
  const dot = {
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
  }[tone];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-subtle px-2.5 py-1 text-xs text-muted">
      <span className={cn("size-1.5 rounded-full", dot)} />
      {label}
    </span>
  );
}
