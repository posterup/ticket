import type { Metadata } from "next";

import { listDiscounts, listEvents } from "@/lib/server";
import {
  PromotionsManager,
  type PromoEventOption,
} from "@/components/promotions/PromotionsManager";

export const metadata: Metadata = { title: "تخفیف‌ها | پوستر" };

export default function PromotionsPage() {
  const discounts = listDiscounts();
  const events: PromoEventOption[] = listEvents().map((e) => ({
    id: e.id,
    title: e.title,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          تخفیف‌ها
        </h1>
        <p className="mt-1 text-sm text-muted">
          کدهای تخفیف بسازید تا خریداران هنگام تهیه بلیت از آن‌ها استفاده کنند.
        </p>
      </div>
      <PromotionsManager seedDiscounts={discounts} events={events} />
    </div>
  );
}
