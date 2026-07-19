"use client";

import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";

// Leaflet touches `window`, so the map is client-only (no SSR).
const LocationMap = dynamic(() => import("@/components/create/LocationMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-64 w-full place-items-center rounded-lg border border-border bg-subtle text-sm text-muted">
      در حال بارگذاری نقشه…
    </div>
  ),
});

/** Map-based location picker: tap to drop a pin, drag to adjust. */
export function LocationPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const hasPin = lat != null && lng != null;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">موقعیت روی نقشه</span>
      <LocationMap lat={lat} lng={lng} onChange={onChange} />
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <MapPin className="size-3.5 text-faint" aria-hidden />
        {hasPin
          ? `پین انتخاب شد: ${lat.toFixed(5)}، ${lng.toFixed(5)} — برای جابه‌جایی بکشید.`
          : "روی نقشه بزنید تا محل رویداد مشخص شود."}
      </p>
    </div>
  );
}
