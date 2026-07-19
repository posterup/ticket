import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { EventInfoForm, VenueForm } from "@/lib/wizard/types";
import type { Errors } from "@/lib/wizard/validation";

interface StepEventInfoProps {
  value: EventInfoForm;
  errors: Errors;
  onChange: (patch: Partial<EventInfoForm>) => void;
  onVenueChange: (patch: Partial<VenueForm>) => void;
}

/** Step 1: core event information (title, description, venue). */
export function StepEventInfo({
  value,
  errors,
  onChange,
  onVenueChange,
}: StepEventInfoProps) {
  const { venue } = value;
  return (
    <div className="flex flex-col gap-6">
      <Field id="title" label="عنوان رویداد" required error={errors.title}>
        <Input
          id="title"
          value={value.title}
          onChange={(e) => onChange({ title: e.target.value })}
          aria-invalid={Boolean(errors.title)}
          placeholder="مثلاً همایش سالانه فناوری"
        />
      </Field>

      <Field
        id="description"
        label="توضیحات"
        hint="مختصری درباره رویداد، برنامه و مخاطبان."
      >
        <Textarea
          id="description"
          value={value.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="توضیح کوتاهی درباره رویداد بنویسید…"
        />
      </Field>

      <div className="rounded-lg border border-border p-5">
        <h3 className="mb-4 text-sm font-semibold text-foreground">
          محل برگزاری
        </h3>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            id="venue-name"
            label="نام محل"
            required
            error={errors.venueName}
          >
            <Input
              id="venue-name"
              value={venue.name}
              onChange={(e) => onVenueChange({ name: e.target.value })}
              aria-invalid={Boolean(errors.venueName)}
              placeholder="مثلاً مرکز همایش‌های برج میلاد"
            />
          </Field>

          <Field id="venue-city" label="شهر" required error={errors.venueCity}>
            <Input
              id="venue-city"
              value={venue.city}
              onChange={(e) => onVenueChange({ city: e.target.value })}
              aria-invalid={Boolean(errors.venueCity)}
              placeholder="تهران"
            />
          </Field>

          <Field
            id="venue-address"
            label="آدرس"
            required
            error={errors.venueAddress}
            className="sm:col-span-2"
          >
            <Input
              id="venue-address"
              value={venue.address}
              onChange={(e) => onVenueChange({ address: e.target.value })}
              aria-invalid={Boolean(errors.venueAddress)}
              placeholder="نشانی کامل محل برگزاری"
            />
          </Field>

          <Field
            id="venue-capacity"
            label="ظرفیت محل"
            required
            error={errors.venueCapacity}
          >
            <Input
              id="venue-capacity"
              type="number"
              min={1}
              inputMode="numeric"
              value={venue.capacity}
              onChange={(e) => onVenueChange({ capacity: e.target.value })}
              aria-invalid={Boolean(errors.venueCapacity)}
              placeholder="۵۰۰"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}
