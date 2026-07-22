"use client";

import { useMemo, useState } from "react";
import { Handshake, Phone, AtSign, Clock, Check, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { EventCollaborator } from "@/types";

export interface WorkspaceLite {
  slug: string;
  name: string;
  avatar: string;
}

type Channel = "workspace" | "phone" | "username";
type Status = "pending" | "accepted";

interface Row {
  id: string;
  key: string;
  label: string;
  sub: string;
  avatar?: string;
  channel: Channel;
  status: Status;
}

const isPhone = (v: string) => /^[+\d][\d\s-]*$/.test(v);

function toRow(c: EventCollaborator): Row {
  return {
    id: c.id,
    key: c.workspaceSlug ? `ws:${c.workspaceSlug}` : `raw:${c.label}`,
    label: c.label,
    sub: c.sub,
    avatar: c.avatar,
    channel: c.channel,
    status: c.status,
  };
}

/**
 * Invite another host or workspace to co-manage this event. Persists requests
 * via `/api/events/:id/collaborators`.
 */
export function EventCollaborators({
  eventId,
  workspaces,
  initial = [],
}: {
  eventId: string;
  workspaces: WorkspaceLite[];
  initial?: EventCollaborator[];
}) {
  const [rows, setRows] = useState<Row[]>(initial.map(toRow));
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const q = query.trim().toLowerCase().replace(/^@/, "");

  const suggestions = useMemo(() => {
    if (!q) return [];
    return workspaces
      .filter((w) => !rows.some((r) => r.key === `ws:${w.slug}`))
      .filter(
        (w) =>
          w.name.toLowerCase().includes(q) || w.slug.toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [q, workspaces, rows]);

  async function add(payload: {
    key: string;
    label: string;
    sub: string;
    avatar?: string;
    channel: Channel;
    workspaceSlug?: string;
  }) {
    if (rows.some((r) => r.key === payload.key)) {
      setError("برای این همکار قبلاً درخواست ارسال شده است.");
      return;
    }
    setQuery("");
    setError("");
    try {
      const res = await fetch(`/api/events/${eventId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: payload.channel,
          label: payload.label,
          sub: payload.sub,
          workspaceSlug: payload.workspaceSlug,
          avatar: payload.avatar,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error();
      setRows((prev) => [
        { ...payload, id: json.data.id, status: "pending" },
        ...prev,
      ]);
    } catch {
      setError("خطا در ارسال درخواست.");
    }
  }

  function addWorkspace(w: WorkspaceLite) {
    add({
      key: `ws:${w.slug}`,
      label: w.name,
      sub: `@${w.slug}`,
      avatar: w.avatar,
      channel: "workspace",
      workspaceSlug: w.slug,
    });
  }

  function addRaw() {
    const v = query.trim().replace(/^@/, "");
    if (!v) return setError("نام کاربری یا شماره تماس را وارد کنید.");
    const channel: Channel = isPhone(v) ? "phone" : "username";
    const sub = channel === "phone" ? "شماره تماس" : "نام کاربری";
    add({ key: `raw:${v}`, label: v, sub, channel });
  }

  function remove(id: string) {
    setRows((prev) => prev.filter((c) => c.id !== id));
    void fetch(`/api/events/${eventId}/collaborators/${id}`, { method: "DELETE" });
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Handshake className="size-4 text-faint" aria-hidden />
          همکاری در رویداد
        </h2>
        <p className="mt-1 text-xs text-muted">
          فضای کاری یا میزبان دیگری را با نام کاربری یا شماره تماس
          جست‌وجو کنید و برای مدیریت مشترک این رویداد درخواست بفرستید.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          addRaw();
        }}
        className="flex flex-col gap-1.5"
      >
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="نام کاربری یا شماره تماس"
            dir="ltr"
            aria-label="جست‌وجوی همکار"
            className="h-11 flex-1 rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors placeholder:text-faint hover:border-border-strong focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring/15"
          />
          <Button type="submit" size="md" className="shrink-0">
            <Handshake aria-hidden />
            درخواست
          </Button>
        </div>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </form>

      {suggestions.length > 0 ? (
        <ul className="flex flex-col gap-1 rounded-lg border border-border p-1">
          {suggestions.map((w) => (
            <li key={w.slug}>
              <button
                type="button"
                onClick={() => addWorkspace(w)}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-start outline-none transition-colors hover:bg-subtle focus-visible:bg-subtle"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-foreground text-xs font-bold text-background">
                  {w.avatar}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">{w.name}</span>
                  <span className="block text-xs text-muted" dir="ltr">
                    @{w.slug}
                  </span>
                </span>
                <Handshake className="size-4 shrink-0 text-faint" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {rows.length > 0 ? (
        <ul className="flex flex-col gap-2 border-t border-border pt-4">
          {rows.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-lg border border-border p-3"
            >
              <Leading row={c} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">{c.label}</span>
                <span className="block truncate text-xs text-muted" dir="ltr">
                  {c.sub}
                </span>
              </span>
              <StatusPill status={c.status} />
              <button
                type="button"
                onClick={() => remove(c.id)}
                aria-label="لغو درخواست"
                className="grid size-8 shrink-0 place-items-center rounded-md text-faint outline-none transition-colors hover:bg-subtle hover:text-danger focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Leading({ row }: { row: Row }) {
  if (row.channel === "workspace") {
    return (
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-foreground text-xs font-bold text-background">
        {row.avatar}
      </span>
    );
  }
  const Icon = row.channel === "phone" ? Phone : AtSign;
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-subtle text-muted">
      <Icon className="size-4" aria-hidden />
    </span>
  );
}

function StatusPill({ status }: { status: Status }) {
  const map = {
    pending: { label: "در انتظار پاسخ", cls: "text-muted", Icon: Clock },
    accepted: { label: "همکار", cls: "text-success", Icon: Check },
  }[status];
  const { Icon } = map;
  return (
    <span
      className={cn(
        "hidden items-center gap-1 rounded-full border border-border bg-subtle px-2 py-0.5 text-xs sm:inline-flex",
        map.cls,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {map.label}
    </span>
  );
}
