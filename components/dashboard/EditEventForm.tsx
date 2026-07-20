"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EventStatusBadge } from "@/components/dashboard/EventStatusBadge";
import { STATUS_LABELS } from "@/lib/events/labels";
import type { EventStatus } from "@/types";

const STATUSES: EventStatus[] = ["draft", "published", "cancelled", "completed"];

interface Props {
  eventId: string;
  title: string;
  description: string;
  status: EventStatus;
}

/** Event header with an inline edit mode for title, description and status. */
export function EditEventForm({ eventId, title, description, status }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title, description, status });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setForm({ title, description, status });
    setError("");
    setEditing(false);
  }

  async function save() {
    if (!form.title.trim()) {
      setError("عنوان رویداد الزامی است.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          status: form.status,
        }),
      });
      if (!res.ok) throw new Error("خطا در ذخیرهٔ تغییرات.");
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
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          <EventStatusBadge status={status} />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="ms-auto"
            onClick={() => setEditing(true)}
          >
            <Pencil aria-hidden />
            ویرایش
          </Button>
        </div>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-col gap-4">
        <Field id="edit-title" label="عنوان" required>
          <Input
            id="edit-title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </Field>
        <Field id="edit-desc" label="توضیحات">
          <Textarea
            id="edit-desc"
            rows={3}
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />
        </Field>
        <Field id="edit-status" label="وضعیت">
          <Select
            id="edit-status"
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({ ...f, status: e.target.value as EventStatus }))
            }
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
        <div className="flex items-center gap-2">
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
      </div>
    </div>
  );
}
