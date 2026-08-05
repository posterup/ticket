"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EditButton } from "@/components/dashboard/EditButton";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  eventId: string;
  title: string;
  description: string;
}

/**
 * Overview-tab card for editing the event title and description. Event
 * lifecycle status is not editable here — hosts manage state per سانس instead.
 */
export function EditEventForm({ eventId, title, description }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title, description });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setForm({ title, description });
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
      <section className="rounded-lg border border-border p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileText className="size-4 text-faint" aria-hidden />
            عنوان و توضیحات
          </h2>
          <EditButton onClick={() => setEditing(true)} />
        </div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {description}
          </p>
        ) : (
          <p className="mt-1 text-sm text-faint">بدون توضیحات</p>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
        <FileText className="size-4 text-faint" aria-hidden />
        عنوان و توضیحات
      </h2>
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
        {error ? <p className="text-xs text-danger-text">{error}</p> : null}
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
    </section>
  );
}
