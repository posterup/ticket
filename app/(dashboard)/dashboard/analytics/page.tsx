import type { Metadata } from "next";
import { TrendingUp, Ticket, Percent, Receipt } from "lucide-react";

import { computeAnalytics } from "@/lib/analytics/compute";
import { formatNumber, formatToman } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BarChart } from "@/components/analytics/BarChart";

export const metadata: Metadata = { title: "تحلیل | پوستر" };

const faPercent = (ratio: number) =>
  `${(ratio * 100).toLocaleString("fa-IR", { maximumFractionDigits: 0 })}٪`;

export default function AnalyticsPage() {
  const a = computeAnalytics();
  const maxSold = Math.max(...a.byCategory.map((c) => c.sold), 1);

  const kpis = [
    { label: "درآمد کل", value: formatToman(a.revenue), icon: TrendingUp },
    { label: "بلیت فروخته‌شده", value: formatNumber(a.ticketsSold), icon: Ticket },
    { label: "نرخ تبدیل", value: faPercent(a.conversion), icon: Percent },
    { label: "میانگین قیمت بلیت", value: formatToman(a.avgPrice), icon: Receipt },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            تحلیل
          </h1>
          <p className="mt-1 text-sm text-muted">
            عملکرد فروش و درآمد رویدادهای شما.
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
              <div className="mt-3 text-xl font-bold text-foreground">
                {k.value}
              </div>
              <div className="mt-1 text-sm text-muted">{k.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-6 text-sm font-semibold text-foreground">
            روند درآمد ماهانه
          </h2>
          <BarChart
            data={a.monthly}
            formatValue={formatToman}
            ariaLabel="نمودار درآمد ماهانه"
          />
        </section>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-6 text-sm font-semibold text-foreground">
            فروش بر اساس دسته بلیت
          </h2>
          <ul className="flex flex-col gap-4">
            {a.byCategory.map((c) => (
              <li key={c.category} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{c.label}</span>
                  <span className="text-muted">{formatNumber(c.sold)} بلیت</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-subtle">
                  <span
                    className={cn("block h-full rounded-full bg-foreground")}
                    style={{ width: `${(c.sold / maxSold) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
