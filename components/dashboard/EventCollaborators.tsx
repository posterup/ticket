"use client";

import { useMemo, useState } from "react";
import { Handshake, Mail, Phone, AtSign, Clock, Check, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface WorkspaceLite {
  slug: string;
  name: string;
  avatar: string;
}

type Channel = "workspace" | "email" | "phone" | "username";
type Status = "pending" | "accepted";

interface Collaborator {
  id: string;
  key: string;
  label: string;
  /** @slug for a workspace; contact type hint otherwise. */
  sub: string;
  avatar?: string;
  channel: Channel;
  status: Status;
}

const isEmail = (v: string) => /@/.test(v) && /\./.test(v);
const isPhone = (v: string) => /^[+\d][\d\s-]*$/.test(v);

/**
 * Invite another host or workspace to co-manage this event. Search existing
 * workspaces by name or username, or send a request to a raw username, email,
 * or phone. Mock/local state until a persisted collaborator model lands.
 */
export function EventCollaborators({
  workspaces,
}: {
  workspaces: WorkspaceLite[];
}) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const q = query.trim().toLowerCase().replace(/^@/, "");

  const suggestions = useMemo(() => {
    if (!q) return [];
    return workspaces
      .filter((w) => !collaborators.some((c) => c.key === `ws:${w.slug}`))
      .filter(
        (w) =>
          w.name.toLowerCase().includes(q) || w.slug.toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [q, workspaces, collaborators]);

  function add(c: Omit<Collaborator, "id" | "status">) {
    if (collaborators.some((x) => x.key === c.key)) {
      setError("برای این همکار قبلاً درخواست ارسال شده است.");
      return;
    }
    setCollaborators((prev) => [
      { ...c, id: crypto.randomUUID(), status: "pending" },
      ...prev,
    ]);
    setQuery("");
    setError("");
  }

  function addWorkspace(w: WorkspaceLite) {
    add({
      key: `ws:${w.slug}`,
      label: w.name,
      sub: `@${w.slug}`,
      avatar: w.avatar,
      channel: "workspace",
    });
  }

  function addRaw() {
    const v = query.trim().replace(/^@/, "");
    if (!v) return setError("نام کاربری، ایمیل یا شماره تماس را وارد کنید.");
    const channel: Channel = isEmail(v)
      ? "email"
      : isPhone(v)
        ? "phone"
        : "username";
    const sub =
      channel === "email"
        ? "ایمیل"
        : channel === "phone"
          ? "شماره تماس"
          : "نام کاربری";
    add({ key: `raw:${v}`, label: v, sub, channel });
  }

  function remove(id: string) {
    setCollaborators((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Handshake className="size-4 text-faint" aria-hidden />
          همکاری در رویداد
        </h2>
        <p className="mt-1 text-xs text-muted">
          فضای کاری یا میزبان دیگری را با نام کاربری، ایمیل یا شماره تماس
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
            placeholder="نام کاربری، ایمیل یا شماره تماس"
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

      {/* Workspace search results */}
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
                  <span className="block truncate text-sm text-foreground">
                    {w.name}
                  </span>
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

      {/* Requested collaborators */}
      {collaborators.length > 0 ? (
        <ul className="flex flex-col gap-2 border-t border-border pt-4">
          {collaborators.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-lg border border-border p-3"
            >
              <Leading collaborator={c} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">
                  {c.label}
                </span>
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

function Leading({ collaborator }: { collaborator: Collaborator }) {
  if (collaborator.channel === "workspace") {
    return (
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-foreground text-xs font-bold text-background">
        {collaborator.avatar}
      </span>
    );
  }
  const Icon =
    collaborator.channel === "email"
      ? Mail
      : collaborator.channel === "phone"
        ? Phone
        : AtSign;
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
