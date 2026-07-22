"use client";

import { useEffect, useState } from "react";
import { Link2, Copy, Check, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * Shareable link to the event's public ticket page — the URL organizers hand
 * out so people can buy tickets. Shows the full link with a copy button and
 * lets the organizer set a custom slug. Slug edits are local/mock until a
 * persisted event-slug lands (the public route is by id today).
 */
export function EventLinkForm({ slug: initialSlug }: { slug: string }) {
  const [origin, setOrigin] = useState("https://poster.ir");
  const [slug, setSlug] = useState(initialSlug);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialSlug);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const url = `${origin}/events/${slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  function save() {
    const next = draft.trim().replace(/^\/+|\/+$/g, "").replace(/\s+/g, "-");
    if (!next) return;
    setSlug(next);
    setEditing(false);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Link2 className="size-4 text-faint" aria-hidden />
            لینک صفحه رویداد
          </h2>
          <p className="mt-1 text-xs text-muted">
            این لینک را به اشتراک بگذارید تا مخاطبان بلیت بخرند.
          </p>
        </div>
        {!editing ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(slug);
              setEditing(true);
            }}
          >
            <Pencil aria-hidden />
            تغییر لینک
          </Button>
        ) : null}
      </div>

      {!editing ? (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-subtle px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm text-foreground" dir="ltr">
            {url}
          </span>
          <button
            type="button"
            onClick={copy}
            aria-label="کپی لینک"
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-success" aria-hidden />
                کپی شد
              </>
            ) : (
              <>
                <Copy className="size-3.5" aria-hidden />
                کپی
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <Field
            id="slug"
            label="نشانی اختصاصی"
            hint={`${origin}/events/…`}
          >
            <Input
              id="slug"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="my-event"
              dir="ltr"
            />
          </Field>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={save}>
              <Check aria-hidden />
              ذخیره لینک
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
            >
              <X aria-hidden />
              انصراف
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
