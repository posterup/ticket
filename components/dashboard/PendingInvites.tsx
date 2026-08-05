"use client";

/**
 * Collaboration invites awaiting this user's answer.
 *
 * `/api/me/invites` existed with nothing rendering it, and the notifications
 * page was a hardcoded empty state that said «اعلانی ندارید» whether or not
 * anything was waiting. So an invitation to co-host an event was delivered to
 * an endpoint nobody read.
 *
 * Accept and decline go through the same route the organiser uses to revoke;
 * the server tells the two apart by who is asking rather than by a flag in the
 * body, so an invitee cannot revoke and an organiser cannot accept on their
 * behalf.
 */

import { useCallback, useState } from "react";
import { Check, Mail, X } from "lucide-react";

import { apiFetch, ApiCallError, useApi } from "@/lib/client/api";
import { formatJalaliDate } from "@/lib/format";
import { AsyncState } from "@/components/ui/async-state";
import { Button } from "@/components/ui/button";
import type { EventCollaborator, EventCollabRole } from "@/types";
import { WorkspaceAvatar } from "@/components/workspace/WorkspaceAvatar";

const ROLE_LABEL: Record<EventCollabRole, string> = {
  "co-host": "میزبان همکار",
  checkin: "ورودی و پذیرش",
};

export function PendingInvites() {
  const { data, error, loading, reload } =
    useApi<EventCollaborator[]>("/api/me/invites");
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const respond = useCallback(
    async (invite: EventCollaborator, action: "accept" | "decline") => {
      setBusy(invite.id);
      setFailure(null);
      try {
        await apiFetch(
          `/api/events/${invite.eventId}/collaborators/${invite.id}`,
          { method: "PATCH", body: JSON.stringify({ action }) },
        );
        reload();
      } catch (e) {
        setFailure(
          e instanceof ApiCallError ? e.message : "ثبت پاسخ ممکن نشد.",
        );
      } finally {
        setBusy(null);
      }
    },
    [reload],
  );

  if (!data) {
    return <AsyncState loading={loading} error={error} onRetry={reload} variant="list" rows={2} />;
  }

  if (!data.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-10 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-subtle text-muted">
          <Mail className="size-6" aria-hidden />
        </span>
        <p className="text-sm font-medium text-foreground">دعوتی ندارید</p>
        <p className="max-w-xs text-sm text-muted">
          وقتی برگزارکننده‌ای شما را به همکاری در رویدادی دعوت کند، این‌جا
          می‌بینید.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {failure ? (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger-text">
          {failure}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {data.map((invite) => (
          <li
            key={invite.id}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-start gap-3">
              {invite.avatar ? (
                <WorkspaceAvatar src={invite.avatar} className="size-9 rounded-full" />
              ) : (
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-text">
                  <Mail className="size-4" aria-hidden />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {invite.label}
                </p>
                <p className="text-xs text-muted">
                  دعوت به {ROLE_LABEL[invite.role]} ·{" "}
                  {formatJalaliDate(invite.createdAt)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-border pt-3">
              <Button
                size="sm"
                disabled={busy === invite.id}
                onClick={() => respond(invite, "accept")}
              >
                <Check aria-hidden />
                پذیرفتن
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy === invite.id}
                onClick={() => respond(invite, "decline")}
              >
                <X aria-hidden />
                رد کردن
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
