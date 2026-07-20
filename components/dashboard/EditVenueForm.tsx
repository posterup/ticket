"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Pencil, Check, X } from "lucide-react";

import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/create/ui";
import { LocationPicker } from "@/components/create/LocationPicker";
import { IRAN_PROVINCES, citiesOfProvince } from "@/lib/create/iran-locations";
import type { Venue } from "@/types";

/** Venue card with an inline editor mirroring the composer's location step. */
export function EditVenueForm({
  eventId,
  venue,
}: {
  eventId: string;
  venue: Venue;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: venue.name ?? "",
    province: venue.province ?? "",
    city: venue.city ?? "",
    address: venue.address ?? "",
    capacity: String(venue.capacity ?? 0),
    lat: venue.lat ?? null,
    lng: venue.lng ?? null,
    hideAddress: venue.hideAddress ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setForm({
      name: venue.name ?? "",
      province: venue.province ?? "",
      city: venue.city ?? "",
      address: venue.address ?? "",
      capacity: String(venue.capacity ?? 0),
      lat: venue.lat ?? null,
      lng: venue.lng ?? null,
      hideAddress: venue.hideAddress ?? false,
    });
    setError("");
    setEditing(false);
  }

  async function save() {
    if (!form.province.trim()) return setError("استان را انتخاب کنید.");
    if (!form.city.trim()) return setError("شهر را انتخاب کنید.");
    const cap = Math.max(0, Math.floor(Number(form.capacity) || 0));
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/events/${eventId}/venue`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          province: form.province,
          city: form.city,
          address: form.address.trim(),
          capacity: cap,
          hideAddress: form.hideAddress,
          ...(form.lat != null && form.lng != null
            ? { lat: form.lat, lng: form.lng }
            : {}),
        }),
      });
      if (!res.ok) throw new Error("خطا در ذخیرهٔ محل برگزاری.");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای ناشناخته رخ داد.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <section className="rounded-lg border border-border p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <MapPin className="size-4 text-faint" aria-hidden />
            محل برگزاری
          </h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setEditing(true)}
          >
            <Pencil aria-hidden />
            ویرایش
          </Button>
        </div>
        {venue.name ? (
          <p className="text-sm text-foreground">{venue.name}</p>
        ) : null}
        {venue.address ? (
          <p className="mt-1 text-sm text-muted">{venue.address}</p>
        ) : null}
        <p className="mt-1 text-sm text-muted">
          {[venue.province, venue.city].filter(Boolean).join("، ")} · ظرفیت{" "}
          {formatNumber(venue.capacity)} نفر
        </p>
        {venue.hideAddress ? (
          <p className="mt-1 text-xs text-faint">
            آدرس و نقشه در صفحهٔ رویداد پنهان است.
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
        <MapPin className="size-4 text-faint" aria-hidden />
        محل برگزاری
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="v-province" label="استان" required>
          <Select
            id="v-province"
            value={form.province}
            onChange={(e) =>
              setForm((f) => ({ ...f, province: e.target.value, city: "" }))
            }
          >
            <option value="">انتخاب استان…</option>
            {IRAN_PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="v-city" label="شهر" required>
          <Select
            id="v-city"
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            disabled={!form.province}
          >
            <option value="">
              {form.province ? "انتخاب شهر…" : "ابتدا استان را انتخاب کنید"}
            </option>
            {citiesOfProvince(form.province).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field id="v-name" label="نام محل" hint="اختیاری — مثلاً سالن یا مجموعه.">
            <Input
              id="v-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="مثلاً تالار وحدت"
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field id="v-address" label="آدرس">
            <Input
              id="v-address"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </Field>
        </div>
        <Field id="v-capacity" label="ظرفیت">
          <Input
            id="v-capacity"
            type="number"
            inputMode="numeric"
            min={0}
            value={form.capacity}
            onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
          />
        </Field>
        <div className="sm:col-span-2">
          <LocationPicker
            lat={form.lat}
            lng={form.lng}
            onChange={(lat, lng) => setForm((f) => ({ ...f, lat, lng }))}
          />
        </div>
        <div className="sm:col-span-2">
          <Toggle
            label="پنهان‌کردن آدرس و نقشه"
            hint="اگر فعال باشد، آدرس دقیق و موقعیت روی نقشه در صفحهٔ رویداد نمایش داده نمی‌شود."
            checked={form.hideAddress}
            onChange={(v) => setForm((f) => ({ ...f, hideAddress: v }))}
          />
        </div>
      </div>
      {error ? <p className="mt-3 text-xs text-danger">{error}</p> : null}
      <div className="mt-4 flex items-center gap-2">
        <Button type="button" size="sm" onClick={save} disabled={saving}>
          <Check aria-hidden />
          {saving ? "در حال ذخیره…" : "ذخیره"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={reset}
          disabled={saving}
        >
          <X aria-hidden />
          انصراف
        </Button>
      </div>
    </section>
  );
}
