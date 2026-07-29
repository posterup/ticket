import type { Metadata } from "next";

import { computeFinance, WITHDRAW_FEE } from "@/lib/finance/compute";
import { formatToman } from "@/lib/format";
import { cn } from "@/lib/utils";
import { WalletPanel } from "@/components/finance/WalletPanel";
import { requireManagerPage } from "@/lib/server/auth/guards";

export const metadata: Metadata = { title: "مالی | پوستر" };

export default async function FinancePage() {
  await requireManagerPage();

  const f = await computeFinance();

  return (
    <div className="flex flex-col gap-8">
      <WalletPanel
        balance={f.balance}
        fee={WITHDRAW_FEE}
        accounts={f.bankAccounts}
        withdrawals={f.withdrawals}
      />

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
