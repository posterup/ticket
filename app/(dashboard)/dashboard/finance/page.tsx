"use client";

import { useApi } from "@/lib/client/api";
import { useActiveWorkspace } from "@/components/dashboard/ActiveWorkspace";
import { AsyncState } from "@/components/ui/async-state";
import { formatToman } from "@/lib/format";
import { cn } from "@/lib/utils";
import { WalletPanel } from "@/components/finance/WalletPanel";
import type { Finance } from "@/lib/server/finance";

/** Mirrors WITHDRAW_FEE; the server is still the authority on the amount. */
const WITHDRAW_FEE = 5_000;

export default function FinancePage() {
  const workspace = useActiveWorkspace();
  const { data, error, loading, reload } = useApi<Finance>(
    workspace ? `/api/workspaces/${workspace.slug}/finance` : null,
  );

  if (!data) {
    return (
      <AsyncState
        loading={loading || !workspace}
        error={error}
        onRetry={reload}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <WalletPanel
        balance={data.balance}
        fee={WITHDRAW_FEE}
        accounts={data.bankAccounts}
        withdrawals={data.withdrawals}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">
          تراکنش‌های اخیر
        </h2>
        {data.transactions.length === 0 ? (
          <p className="rounded-lg border border-border p-6 text-center text-sm text-muted">
            هنوز فروشی ثبت نشده است.
          </p>
        ) : (
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
              <tbody>
                {data.transactions.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3 text-foreground">{t.buyer}</td>
                    <td className="px-5 py-3 text-muted">{t.event}</td>
                    <td className="px-5 py-3 text-foreground">
                      {formatToman(t.amount)}
                    </td>
                    <td
                      className={cn(
                        "px-5 py-3",
                        t.status === "refunded" ? "text-danger" : "text-success",
                      )}
                    >
                      {t.status === "refunded" ? "بازگشت وجه" : "پرداخت‌شده"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
