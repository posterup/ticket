"use client";

import { useEffect } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

/** Tehran — default map center when no pin has been placed yet. */
const TEHRAN: [number, number] = [35.6892, 51.389];

// Monochrome teardrop pin (avoids Leaflet's default marker-image asset issue).
const pinIcon = L.divIcon({
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 27],
  html: `<svg width="28" height="28" viewBox="0 0 24 24" fill="#111111" stroke="#ffffff" stroke-width="1.5" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))"><path d="M12 21s7-6.5 7-12A7 7 0 1 0 5 9c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.4" fill="#ffffff" stroke="none"/></svg>`,
});

function ClickToPlace({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Recalculate the map size once mounted (it renders into a laid-out section). */
function InvalidateSizeOnMount() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 0);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

export default function LocationMap({
  lat,
  lng,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const hasPin = lat != null && lng != null;
  const center: [number, number] = hasPin ? [lat, lng] : TEHRAN;

  return (
    <MapContainer
      center={center}
      zoom={12}
      scrollWheelZoom={false}
      className="poster-map h-64 w-full rounded-lg border border-border"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <InvalidateSizeOnMount />
      <ClickToPlace onChange={onChange} />
      {hasPin ? (
        <Marker
          position={[lat, lng]}
          icon={pinIcon}
          draggable
          eventHandlers={{
            dragend(e) {
              const p = e.target.getLatLng();
              onChange(p.lat, p.lng);
            },
          }}
        />
      ) : null}
    </MapContainer>
  );
}
