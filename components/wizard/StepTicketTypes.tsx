import { Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { TicketTypeForm } from "@/lib/wizard/types";
import type { Errors } from "@/lib/wizard/validation";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/wizard/labels";
import type { TicketCategory } from "@/types";

interface StepTicketTypesProps {
  ticketTypes: TicketTypeForm[];
  errors: Errors;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<TicketTypeForm>) => void;
  onRemove: (id: string) => void;
}

/** Step 3: unlimited ticket types, each with its own pricing and sales window. */
export function StepTicketTypes({
  ticketTypes,
  errors,
  onAdd,
  onUpdate,
  onRemove,
}: StepTicketTypesProps) {
  return (
    <div className="flex flex-col gap-4">
      {ticketTypes.map((ticket, index) => (
        <TicketTypeCard
          key={ticket.id}
          ticket={ticket}
          index={index}
          errors={errors}
          canRemove={ticketTypes.length > 1}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      ))}

      <Button
        type="button"
        variant="secondary"
        onClick={onAdd}
        className="w-full border-dashed"
      >
        <Plus aria-hidden />
        افزودن نوع بلیت
      </Button>
    </div>
  );
}

interface TicketTypeCardProps {
  ticket: TicketTypeForm;
  index: number;
  errors: Errors;
  canRemove: boolean;
  onUpdate: (id: string, patch: Partial<TicketTypeForm>) => void;
  onRemove: (id: string) => void;
}

function TicketTypeCard({
  ticket,
  index,
  errors,
  canRemove,
  onUpdate,
  onRemove,
}: TicketTypeCardProps) {
  const { id } = ticket;
  return (
    <div className="rounded-lg border border-border p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {`نوع بلیت ${index + 1}`}
        </h3>
        <button
          type="button"
          onClick={() => onRemove(id)}
          disabled={!canRemove}
          aria-label={`حذف نوع بلیت ${index + 1}`}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-md text-muted outline-none transition-colors",
            "hover:bg-subtle hover:text-danger focus-visible:ring-2 focus-visible:ring-ring/15",
            "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted",
          )}
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          id={`${id}-name`}
          label="نام بلیت"
          required
          error={errors[`${id}.name`]}
        >
          <Input
            id={`${id}-name`}
            value={ticket.name}
            onChange={(e) => onUpdate(id, { name: e.target.value })}
            aria-invalid={Boolean(errors[`${id}.name`])}
            placeholder="مثلاً بلیت عمومی"
          />
        </Field>

        <Field id={`${id}-category`} label="دسته">
          <Select
            id={`${id}-category`}
            value={ticket.category}
            onChange={(e) =>
              onUpdate(id, { category: e.target.value as TicketCategory })
            }
          >
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          id={`${id}-price`}
          label="قیمت (تومان)"
          required
          hint="برای بلیت رایگان، صفر وارد کنید."
          error={errors[`${id}.price`]}
        >
          <Input
            id={`${id}-price`}
            type="number"
            min={0}
            inputMode="numeric"
            value={ticket.price}
            onChange={(e) => onUpdate(id, { price: e.target.value })}
            aria-invalid={Boolean(errors[`${id}.price`])}
            placeholder="۴۵۰۰۰۰"
          />
        </Field>

        <Field
          id={`${id}-capacity`}
          label="ظرفیت"
          required
          error={errors[`${id}.capacity`]}
        >
          <Input
            id={`${id}-capacity`}
            type="number"
            min={1}
            inputMode="numeric"
            value={ticket.capacity}
            onChange={(e) => onUpdate(id, { capacity: e.target.value })}
            aria-invalid={Boolean(errors[`${id}.capacity`])}
            placeholder="۱۰۰"
          />
        </Field>

        <Field
          id={`${id}-salesStart`}
          label="شروع فروش"
          required
          error={errors[`${id}.salesStart`]}
        >
          <Input
            id={`${id}-salesStart`}
            type="date"
            value={ticket.salesStartDate}
            onChange={(e) => onUpdate(id, { salesStartDate: e.target.value })}
            aria-invalid={Boolean(errors[`${id}.salesStart`])}
          />
        </Field>

        <Field
          id={`${id}-salesEnd`}
          label="پایان فروش"
          required
          error={errors[`${id}.salesEnd`]}
        >
          <Input
            id={`${id}-salesEnd`}
            type="date"
            value={ticket.salesEndDate}
            onChange={(e) => onUpdate(id, { salesEndDate: e.target.value })}
            aria-invalid={Boolean(errors[`${id}.salesEnd`])}
          />
        </Field>

        <Field
          id={`${id}-description`}
          label="توضیحات (اختیاری)"
          className="sm:col-span-2"
        >
          <Textarea
            id={`${id}-description`}
            rows={2}
            value={ticket.description}
            onChange={(e) => onUpdate(id, { description: e.target.value })}
            placeholder="مثلاً شامل پذیرایی و دسترسی به سالن اصلی"
          />
        </Field>
      </div>
    </div>
  );
}
