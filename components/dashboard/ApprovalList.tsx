"use client";

import { useMemo, useState } from "react";
import { AtSign, Check, ClipboardCheck, Phone, RotateCcw, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import type { RegistrationStatus } from "@/types";

export interface RegistrationItem {
  id: string;
  name: string;
  contact: string;
  channel: "phone" | "email";
  note?: string;
  status: RegistrationStatus;
}

/**
 * Accept list for approval-gated («ثبت‌نام با تأیید») events. Sits at the very
 * top of the پذیرش و مهمانان tab: pending requests come first with پذیرش/رد
 * actions, decided requests collapse into a compact reviewable list below.
 */
export function ApprovalList({
  eventId,
  registrations: initial,
}: {
  eventId: string;
  registrations: RegistrationItem[];
}) {
  const [items, setItems] = useState<RegistrationItem[]>(initial);

  const pending = useMemo(
    () => items.filter((r) => r.status === "pending"),
    [items],
  );
  const decided = useMemo(
    () => items.filter((r) => r.status !== "pending"),
    [items],
  );
  const accepted = decided.filter((r) => r.status === "accepted").length;

  function setStatus(id: string, status: RegistrationStatus) {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    void fetch(`/api/events/${eventId}/registrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ClipboardCheck className="size-4 text-faint" aria-hidden />
          درخواست‌های ثبت‌نام
        </h2>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="rounded-full border border-border bg-subtle px-2 py-0.5 text-accent">
            {formatNumber(pending.length)} در انتظار بررسی
          </span>
          {accepted > 0 ? (
            <span className="rounded-full border border-border bg-subtle px-2 py-0.5 text-success">
              {formatNumber(accepted)} پذیرفته‌شده
            </span>
          ) : null}
        </div>
      </div>

      {pending.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {pending.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center"
            >
              <Applicant item={r} />
              <div className="flex shrink-0 items-center gap-2 sm:ms-auto">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setStatus(r.id, "accepted")}
                >
                  <Check aria-hidden />
                  پذیرش
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setStatus(r.id, "rejected")}
                >
                  <X aria-hidden />
                  رد
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-subtle/40 p-6 text-center text-xs text-muted">
          درخواست ثبت‌نام در انتظار بررسی نیست.
        </p>
      )}

      {decided.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="text-xs font-medium text-muted">
            بررسی‌شده ({formatNumber(decided.length)})
          </p>
          <ul className="flex flex-col gap-2">
            {decided.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-lg border border-border/70 bg-subtle/30 p-3"
              >
                <Applicant item={r} muted />
                <div className="flex shrink-0 items-center gap-2 sm:ms-auto">
                  <StatusPill status={r.status} />
                  <button
                    type="button"
                    onClick={() => setStatus(r.id, "pending")}
                    aria-label="بازگرداندن به در انتظار بررسی"
                    className="grid size-8 place-items-center rounded-md text-faint outline-none transition-colors hover:bg-subtle hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <RotateCcw className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Applicant({
  item,
  muted = false,
}: {
  item: RegistrationItem;
  muted?: boolean;
}) {
  const ChannelIcon = item.channel === "email" ? AtSign : Phone;
  return (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-xs font-bold text-background">
        {item.name.trim().charAt(0) || "؟"}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-semibold",
            muted ? "text-muted" : "text-foreground",
          )}
        >
          {item.name}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
          <ChannelIcon className="size-3.5 shrink-0 text-faint" aria-hidden />
          <span className="truncate" dir="ltr">
            {item.contact}
          </span>
        </p>
        {item.note ? (
          <p className="mt-1 text-xs leading-relaxed text-muted">{item.note}</p>
        ) : null}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: RegistrationStatus }) {
  const map = {
    pending: { label: "در انتظار", cls: "text-muted", Icon: ClipboardCheck },
    accepted: { label: "پذیرفته‌شد", cls: "text-success", Icon: Check },
    rejected: { label: "رد شد", cls: "text-danger", Icon: X },
  }[status];
  const { Icon } = map;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-subtle px-2 py-0.5 text-xs",
        map.cls,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {map.label}
    </span>
  );
}
