"use client";

import { useApi } from "@/lib/client/api";
import { useActiveWorkspace } from "@/components/dashboard/ActiveWorkspace";
import { AsyncState } from "@/components/ui/async-state";
import { MarketingPanel } from "@/components/marketing/MarketingPanel";
import type { Segment } from "@/lib/server/campaigns";
import type { Campaign } from "@/types";

interface Data {
  campaigns: Campaign[];
  segments: Segment[];
  workspaceId: string;
}

export default function MarketingPage() {
  const workspace = useActiveWorkspace();
  const { data, error, loading, reload } = useApi<Data>(
    workspace ? `/api/workspaces/${workspace.slug}/campaigns` : null,
  );

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

      {data ? (
        <MarketingPanel
          seedCampaigns={data.campaigns}
          segments={data.segments}
          workspaceId={data.workspaceId}
        />
      ) : (
        <AsyncState
          loading={loading || !workspace}
          error={error}
          onRetry={reload}
        />
      )}
    </div>
  );
}
