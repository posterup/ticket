"use client";

import { use } from "react";
import dynamic from "next/dynamic";

import { useApi } from "@/lib/client/api";
import { AsyncState } from "@/components/ui/async-state";
import type { LayoutSpec } from "@/types";

interface LayoutDetail {
  layoutId: string;
  venueId: string;
  venueName: string;
  name: string;
  draft: LayoutSpec;
  publishedVersionId?: string;
  versions: { id: string; version: number; totalSeats: number; publishedAt: string }[];
}

/**
 * The designer measures the DOM and draws to a canvas on mount, so it is
 * client-only — the same reason `LocationPicker` defers Leaflet this way.
 */
const VenueDesigner = dynamic(
  () =>
    import("@/components/admin/designer/VenueDesigner").then(
      (m) => m.VenueDesigner,
    ),
  {
    ssr: false,
    loading: () => <AsyncState loading error={null} />,
  },
);

export default function VenueDesignerPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = use(params);
  const { data, error, loading, reload } = useApi<LayoutDetail>(
    `/api/admin/venues/${venueId}/layout`,
  );

  if (!data) {
    return <AsyncState loading={loading} error={error} onRetry={reload} />;
  }

  return <VenueDesigner layout={data} />;
}
