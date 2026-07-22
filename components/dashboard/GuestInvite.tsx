"use client";

import { useState } from "react";
import { UserPlus, Phone, AtSign, Check, X, Clock, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";

type Rsvp = "pending" | "going" | "declined";

export interface GuestItem {
  id: string;
  sessionId: string;
  contact: string;
  channel: "phone" | "username";
  status: Rsvp;
}

interface SessionOption {
  id: string;
  label: string;
}

const isPhone = (v: string) => /^[+\d][\d\s-]*$/.test(v);

/**
 * Invite guests to a specific session by phone or username. Guests don't pay —
 * they only RSVP. Persists via `/api/events/:id/guests`.
 */
export function GuestInvite({
  eventId,
  sessions,
  initial = [],
}: {
  eventId: string;
  sessions: SessionOption[];
  initial?: GuestItem[];
}) {
  const [guests, setGuests] = useState<GuestItem[]>(initial);
  const [value, setValue] = useState("");
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? "");
  const [error, setError] = useState("");

  const sessionLabel = (id: string) =>
    sessions.find((s) => s.id === id)?.label ?? "سانس";

  async function invite() {
    const contact = value.trim();
    if (!contact) return setError("شماره موبایل یا نام کاربری مهمان را وارد کنید.");
    if (!sessionId) return setError("سانس را انتخاب کنید.");
    if (guests.some((g) => g.contact === contact && g.sessionId === sessionId)) {
      return setError("این مهمان برای این سانس قبلاً دعوت شده است.");
    }
    const channel = isPhone(contact) ? "phone" : "username";
    setValue("");
    setError("");
    try {
      const res = await fetch(`/api/events/${eventId}/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, contact, channel }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error();
      setGuests((prev) => [
        { id: json.data.id, sessionId, contact, channel, status: "pending" },
        ...prev,
      ]);
    } catch {
      setError("خطا در ثبت مهمان.");
    }
  }

  function setStatus(id: string, status: Rsvp) {
    setGuests((prev) => prev.map((g) => (g.id === id ? { ...g, status } : g)));
    void fetch(`/api/events/${eventId}/guests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  function remove(id: string) {
    setGuests((prev) => prev.filter((g) => g.id !== id));
    void fetch(`/api/events/${eventId}/guests/${id}`, { method: "DELETE" });
  }

  const going = guests.filter((g) => g.status === "going").length;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <UserPlus className="size-4 text-faint" aria-hidden />
          دعوت مهمان
        </h2>
        <p className="mt-1 text-xs text-muted">
          مهمان بدون پرداخت به یک سانس دعوت می‌شود و فقط حضور خود را اعلام می‌کند.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          invite();
        }}
        className="flex flex-col gap-3"
      >
        {sessions.length > 0 ? (
          <Field id="guest-session" label="سانس">
            <Select
              id="guest-session"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="شماره موبایل یا نام کاربری"
              dir="ltr"
              aria-label="شماره موبایل یا نام کاربری مهمان"
              className="h-11 flex-1 rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors placeholder:text-faint hover:border-border-strong focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring/15"
            />
            <Button type="submit" size="md" className="shrink-0">
              <UserPlus aria-hidden />
              دعوت
            </Button>
          </div>
          {error ? <p className="text-xs text-danger">{error}</p> : null}
        </div>
      </form>

      {guests.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted">
              فهرست مهمانان ({guests.length})
            </p>
            <span className="text-xs text-success">{going} می‌آیند</span>
          </div>

          <ul className="flex flex-col gap-2">
            {guests.map((g) => {
              const ChannelIcon = g.channel === "username" ? AtSign : Phone;
              return (
                <li
                  key={g.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-subtle text-muted">
                    <ChannelIcon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground" dir="ltr">
                      {g.contact}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {sessionLabel(g.sessionId)}
                    </span>
                  </span>

                  <StatusPill status={g.status} />

                  <div className="flex shrink-0 items-center gap-1">
                    <IconToggle
                      label="می‌آید"
                      active={g.status === "going"}
                      tone="success"
                      onClick={() =>
                        setStatus(g.id, g.status === "going" ? "pending" : "going")
                      }
                    >
                      <Check className="size-4" aria-hidden />
                    </IconToggle>
                    <IconToggle
                      label="نمی‌آید"
                      active={g.status === "declined"}
                      tone="danger"
                      onClick={() =>
                        setStatus(
                          g.id,
                          g.status === "declined" ? "pending" : "declined",
                        )
                      }
                    >
                      <X className="size-4" aria-hidden />
                    </IconToggle>
                    <button
                      type="button"
                      onClick={() => remove(g.id)}
                      aria-label="حذف مهمان"
                      className="grid size-8 place-items-center rounded-md text-faint outline-none transition-colors hover:bg-subtle hover:text-danger focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function StatusPill({ status }: { status: Rsvp }) {
  const map = {
    pending: { label: "در انتظار", cls: "text-muted", Icon: Clock },
    going: { label: "می‌آید", cls: "text-success", Icon: Check },
    declined: { label: "نمی‌آید", cls: "text-danger", Icon: X },
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

function IconToggle({
  label,
  active,
  tone,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  tone: "success" | "danger";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-md border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
        active && tone === "success" && "border-transparent bg-success/10 text-success",
        active && tone === "danger" && "border-transparent bg-danger/10 text-danger",
        !active && "border-border text-muted hover:bg-subtle",
      )}
    >
      {children}
    </button>
  );
}
