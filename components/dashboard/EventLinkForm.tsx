"use client";

import { useEffect, useState } from "react";
import { Link2, Copy, Check, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/** A fresh, system-generated url-safe link id. */
function newLinkId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

/**
 * Shareable link to the event's public ticket page. Organisers don't craft a
 * custom slug — the system auto-generates a new link id on demand (regenerating
 * invalidates the previous link). Persists via `/api/events/:id`.
 */
export function EventLinkForm({
  eventId,
  slug: initialSlug,
}: {
  eventId: string;
  slug: string;
}) {
  const [origin, setOrigin] = useState("https://poster.ir");
  const [slug, setSlug] = useState(initialSlug);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  async function regenerate() {
    const next = newLinkId();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: next }),
      });
      if (!res.ok) throw new Error("خطا در ساخت لینک جدید.");
      setSlug(next);
      setCopied(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای ناشناخته رخ داد.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Link2 className="size-4 text-faint" aria-hidden />
        لینک صفحه رویداد
      </h2>
      <p className="mt-1 text-xs text-muted">
        این لینک را به اشتراک بگذارید تا مخاطبان بلیت بخرند.
      </p>

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

      <div className="mt-3 flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={regenerate}
          disabled={saving}
        >
          <RefreshCw aria-hidden />
          {saving ? "در حال ساخت…" : "تغییر لینک"}
        </Button>
        <p className="text-xs text-muted">
          با ساخت لینک جدید، لینک قبلی از کار می‌افتد.
        </p>
      </div>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
