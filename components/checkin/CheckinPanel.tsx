"use client";

import { useMemo, useState } from "react";
import { Check, QrCode, Search, UserCheck, CircleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { formatNumber } from "@/lib/format";
import type { Holder, SessionRef } from "@/lib/checkin/data";

export interface CheckinEvent {
  id: string;
  title: string;
  sessions: SessionRef[];
  holders: Holder[];
}

type Feedback = { kind: "ok" | "dup" | "err" | "warn"; msg: string };

export function CheckinPanel({ events }: { events: CheckinEvent[] }) {
  const [eventIdx, setEventIdx] = useState(0);
  const event = events[eventIdx];
  const sessions = event?.sessions ?? [];
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? "");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [code, setCode] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const holders = event?.holders ?? [];
  // Check-in is scoped to the selected سانس: only its guests are admitted here.
  const sessionHolders = useMemo(
    () => holders.filter((h) => h.sessionId === sessionId),
    [holders, sessionId],
  );
  const checkedCount = sessionHolders.filter((h) => checked.has(h.id)).length;
  const total = sessionHolders.length;
  const pct = total ? Math.round((checkedCount / total) * 100) : 0;

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return sessionHolders;
    const up = q.toUpperCase();
    return sessionHolders.filter(
      (h) => h.name.includes(q) || h.code.includes(up),
    );
  }, [sessionHolders, query]);

  function switchSession(id: string) {
    setSessionId(id);
    setFeedback(null);
    setQuery("");
  }

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submitCode() {
    const value = code.trim().toUpperCase();
    if (!value) return;
    // Search across the whole event so a wrong-session ticket is detected.
    const holder = holders.find((h) => h.code === value);
    if (!holder) {
      setFeedback({ kind: "err", msg: "کدی با این مشخصات یافت نشد." });
    } else if (holder.sessionId !== sessionId) {
      setFeedback({
        kind: "warn",
        msg: `این بلیت برای سانس «${holder.sessionLabel}» است، نه سانس انتخاب‌شده.`,
      });
    } else if (checked.has(holder.id)) {
      setFeedback({ kind: "dup", msg: `«${holder.name}» قبلاً ثبت شده است.` });
    } else {
      setChecked((prev) => new Set(prev).add(holder.id));
      setFeedback({ kind: "ok", msg: `ورود «${holder.name}» ثبت شد.` });
    }
    setCode("");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {events.length > 1 ? (
          <Field id="event" label="رویداد">
            <Select
              id="event"
              value={String(eventIdx)}
              onChange={(e) => {
                const idx = Number(e.target.value);
                setEventIdx(idx);
                setSessionId(events[idx]?.sessions[0]?.id ?? "");
                setFeedback(null);
                setQuery("");
              }}
            >
              {events.map((ev, i) => (
                <option key={ev.id} value={i}>
                  {ev.title}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        {sessions.length > 0 ? (
          <Field
            id="session"
            label="سانس"
            hint="ورودها فقط برای سانس انتخاب‌شده ثبت می‌شوند."
          >
            <Select
              id="session"
              value={sessionId}
              onChange={(e) => switchSession(e.target.value)}
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        {/* Scan / code entry + progress */}
        <div className="flex flex-col gap-6">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-4 grid h-28 place-items-center rounded-md border border-dashed border-border bg-subtle text-center">
              <div className="flex flex-col items-center gap-1 text-muted">
                <QrCode className="size-7" aria-hidden />
                <span className="text-xs">کد بلیت را اسکن یا وارد کنید</span>
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitCode();
              }}
              className="flex gap-2"
            >
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="مثلاً PSTR-A001"
                dir="ltr"
                aria-label="کد بلیت"
              />
              <Button type="submit" size="md" className="shrink-0">
                ثبت ورود
              </Button>
            </form>
            {feedback ? (
              <p
                role="status"
                className={cn(
                  "mt-3 flex items-center gap-2 text-sm",
                  feedback.kind === "ok" && "text-success",
                  feedback.kind === "dup" && "text-warning",
                  (feedback.kind === "err" || feedback.kind === "warn") &&
                    "text-danger",
                )}
              >
                {feedback.kind === "ok" ? (
                  <Check className="size-4 shrink-0" aria-hidden />
                ) : (
                  <CircleAlert className="size-4 shrink-0" aria-hidden />
                )}
                {feedback.msg}
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-end justify-between">
              <span className="text-sm text-muted">ثبت‌شده در این سانس</span>
              <span className="text-sm font-semibold text-foreground">
                {formatNumber(checkedCount)} از {formatNumber(total)}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-subtle">
              <span
                className="block h-full rounded-full bg-foreground transition-[width]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-faint">{formatNumber(pct)}٪ حاضر</p>
          </div>
        </div>

        {/* Holder list (scoped to the selected سانس) */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute inset-y-0 right-3.5 my-auto size-4 text-faint"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجوی نام یا کد"
              className="pr-10"
              aria-label="جستجوی مهمان"
            />
          </div>

          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {filtered.map((h) => {
              const isChecked = checked.has(h.id);
              return (
                <li
                  key={h.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {h.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      <span dir="ltr">{h.code}</span> · {h.ticketType}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(h.id)}
                    aria-pressed={isChecked}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
                      isChecked
                        ? "border-transparent bg-success/10 text-success"
                        : "border-border text-foreground hover:bg-subtle",
                    )}
                  >
                    {isChecked ? (
                      <>
                        <Check className="size-3.5" aria-hidden />
                        ثبت‌شده
                      </>
                    ) : (
                      <>
                        <UserCheck className="size-3.5" aria-hidden />
                        ثبت ورود
                      </>
                    )}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted">
                برای این سانس مهمانی یافت نشد.
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  );
}
