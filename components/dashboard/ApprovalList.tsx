"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ClipboardCheck,
  Phone,
  RotateCcw,
  Search,
  Ticket,
  User,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import type { RegistrationStatus } from "@/types";

export interface RegistrationItem {
  id: string;
  name: string;
  phone: string;
  tickets: number;
  status: RegistrationStatus;
}

const digits = (v: string) => v.replace(/\D/g, "");

/**
 * Accept list for invite-only («ثبت‌نام با تأیید») events — the whole content of
 * the «درخواست‌های ثبت‌نام» tab. A searchable table (نام · تلفن · بلیت · actions),
 * pending requests first with پذیرش/رد, decided requests below and revertible.
 * Each request carries only the applicant's full name, phone, and ticket count.
 */
export function ApprovalList({
  eventId,
  registrations: initial,
}: {
  eventId: string;
  registrations: RegistrationItem[];
}) {
  const [items, setItems] = useState<RegistrationItem[]>(initial);
  const [query, setQuery] = useState("");

  const pending = useMemo(
    () => items.filter((r) => r.status === "pending"),
    [items],
  );
  const decided = useMemo(
    () => items.filter((r) => r.status !== "pending"),
    [items],
  );
  const accepted = decided.filter((r) => r.status === "accepted").length;

  const q = query.trim().toLowerCase();
  const match = (r: RegistrationItem) =>
    !q ||
    r.name.toLowerCase().includes(q) ||
    (digits(q) !== "" && digits(r.phone).includes(digits(q)));
  // Pending first, then decided — both filtered by the search query.
  const rows = [...pending.filter(match), ...decided.filter(match)];

  function setStatus(id: string, status: RegistrationStatus) {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    void fetch(`/api/events/${eventId}/registrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header + counts */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ClipboardCheck className="size-4 text-faint" aria-hidden />
          درخواست‌های ثبت‌نام
        </h2>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="text-accent">
            {formatNumber(pending.length)} در انتظار
          </span>
          {accepted > 0 ? (
            <span className="text-success">
              {formatNumber(accepted)} پذیرفته‌شده
            </span>
          ) : null}
        </div>
      </div>

      {/* Search by name or phone */}
      {items.length > 0 ? (
        <div className="relative">
          <Search
            className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-faint"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جست‌وجوی نام یا شماره تماس"
            aria-label="جست‌وجوی درخواست‌ها"
            className="h-11 w-full rounded-md border border-border bg-card ps-9 pe-3 text-sm text-foreground outline-none transition-colors placeholder:text-faint hover:border-border-strong focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring/15"
          />
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted">
          درخواست ثبت‌نامی وجود ندارد.
        </p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted">
          موردی مطابق جست‌وجو یافت نشد.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[30rem] text-sm">
            <thead>
              <tr className="border-b border-border bg-subtle/40 text-muted">
                <Th icon={User} label="نام" />
                <Th icon={Phone} label="تلفن" />
                <Th icon={Ticket} label="تعداد بلیت" />
                <th className="w-px px-3 pb-2 pt-3" aria-label="عملیات" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const done = r.status !== "pending";
                return (
                  <tr key={r.id} className={cn(done && "bg-subtle/20")}>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "font-medium",
                          done ? "text-muted" : "text-foreground",
                        )}
                      >
                        {r.name}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-muted" dir="ltr">
                      <span className="block text-end">{r.phone}</span>
                    </td>
                    <td className="px-3 py-3 text-foreground">
                      {formatNumber(r.tickets)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {r.status === "pending" ? (
                          <>
                            <Action
                              label="پذیرش"
                              tone="success"
                              onClick={() => setStatus(r.id, "accepted")}
                            >
                              <Check className="size-4" aria-hidden />
                              پذیرش
                            </Action>
                            <Action
                              label="رد"
                              tone="danger"
                              onClick={() => setStatus(r.id, "rejected")}
                            >
                              <X className="size-4" aria-hidden />
                              رد
                            </Action>
                          </>
                        ) : (
                          <>
                            <StatusText status={r.status} />
                            <button
                              type="button"
                              onClick={() => setStatus(r.id, "pending")}
                              aria-label="بازگرداندن به در انتظار بررسی"
                              className="grid size-8 shrink-0 place-items-center rounded-md text-faint outline-none transition-colors hover:bg-subtle hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                            >
                              <RotateCcw className="size-4" aria-hidden />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Column header: icon stacked on top of the label. */
function Th({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
}) {
  return (
    <th className="px-3 pb-2 pt-3 text-start align-bottom font-medium">
      <span className="flex flex-col items-start gap-1 text-xs">
        <Icon className="size-4 text-faint" aria-hidden />
        {label}
      </span>
    </th>
  );
}

function Action({
  label,
  tone,
  onClick,
  children,
}: {
  label: string;
  tone: "success" | "danger";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
        tone === "success" && "hover:bg-success/10 hover:text-success",
        tone === "danger" && "hover:bg-danger/10 hover:text-danger",
      )}
    >
      {children}
    </button>
  );
}

function StatusText({ status }: { status: RegistrationStatus }) {
  if (status === "pending") return null;
  const map = {
    accepted: { label: "پذیرفته‌شد", cls: "text-success" },
    rejected: { label: "رد شد", cls: "text-danger" },
  }[status];
  return <span className={cn("shrink-0 text-xs", map.cls)}>{map.label}</span>;
}
