import type { Metadata } from "next";

import { listCampaigns, listSegments } from "@/lib/server";
import { MarketingPanel } from "@/components/marketing/MarketingPanel";

export const metadata: Metadata = { title: "بازاریابی | پوستر" };

export default function MarketingPage() {
  const campaigns = listCampaigns();
  const segments = listSegments();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          بازاریابی
        </h1>
        <p className="mt-1 text-sm text-muted">
          کمپین‌های پیامکی را برای مخاطبان خود بسازید و ارسال کنید.
        </p>
      </div>
      <MarketingPanel seedCampaigns={campaigns} segments={segments} />
    </div>
  );
}
