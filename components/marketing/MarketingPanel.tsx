"use client";

import { useState } from "react";
import { MessageSquare, Check, Send, CircleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber, formatJalaliDate } from "@/lib/format";
import type { Campaign } from "@/types";
import type { Segment } from "@/lib/server/campaigns";

export function MarketingPanel({
  seedCampaigns,
  segments,
}: {
  seedCampaigns: Campaign[];
  segments: Segment[];
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(seedCampaigns);
  const [name, setName] = useState("");
  const [segmentId, setSegmentId] = useState(segments[0]?.id ?? "all");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sentInfo, setSentInfo] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const segment = segments.find((s) => s.id === segmentId) ?? segments[0];
  const parts = Math.max(1, Math.ceil(message.length / 70));

  async function send() {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "نام کمپین الزامی است.";
    if (!message.trim()) next.message = "متن پیام الزامی است.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSending(true);
    setSendError(null);
    setSentInfo(null);
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segmentId, message: message.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !("data" in json)) {
        throw new Error(json?.error?.message ?? "ارسال ناموفق بود.");
      }
      const sent = Number(json.data.sent) || segment.count;
      const campaign: Campaign = {
        id: crypto.randomUUID(),
        name: name.trim(),
        channel: "sms",
        segment: segment.label,
        status: "sent",
        recipients: sent,
        message: message.trim(),
      };
      setCampaigns((prev) => [campaign, ...prev]);
      setSentInfo(`کمپین «${campaign.name}» به ${formatNumber(sent)} مخاطب ارسال شد.`);
      setName("");
      setMessage("");
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "ارسال ناموفق بود.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[24rem_1fr]">
      {/* Composer */}
      <div className="flex h-fit flex-col gap-5 rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">کمپین جدید</h2>

        <Field id="name" label="نام کمپین" required error={errors.name}>
          <Input
            id="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSentInfo(null);
            }}
            placeholder="مثلاً یادآوری رویداد"
            aria-invalid={Boolean(errors.name)}
          />
        </Field>

        <Field id="segment" label="مخاطبان">
          <Select
            id="segment"
            value={segmentId}
            onChange={(e) => setSegmentId(e.target.value)}
          >
            {segments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({formatNumber(s.count)})
              </option>
            ))}
          </Select>
        </Field>

        <Field
          id="message"
          label="متن پیام"
          required
          error={errors.message}
          hint={`${formatNumber(message.length)} کاراکتر · ${formatNumber(parts)} پیامک`}
        >
          <Textarea
            id="message"
            rows={4}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setSentInfo(null);
            }}
            aria-invalid={Boolean(errors.message)}
          />
        </Field>

        <Button type="button" onClick={send} disabled={sending}>
          <Send aria-hidden />
          {sending
            ? "در حال ارسال…"
            : `ارسال به ${formatNumber(segment?.count ?? 0)} مخاطب`}
        </Button>

        {sentInfo ? (
          <p className="flex items-center gap-2 text-sm text-success">
            <Check className="size-4" aria-hidden />
            {sentInfo}
          </p>
        ) : null}
        {sendError ? (
          <p className="flex items-start gap-2 text-sm text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {sendError}
          </p>
        ) : null}
      </div>

      {/* Campaign list */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">کمپین‌ها</h2>
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {campaigns.map((c) => (
            <li
              key={c.id}
              className="flex items-start justify-between gap-4 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {c.name}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <ChannelTag />
                  <span>·</span>
                  <span>{c.segment}</span>
                  <span>·</span>
                  <span>{formatNumber(c.recipients)} گیرنده</span>
                  <span>·</span>
                  <span>{c.sentAt ? formatJalaliDate(c.sentAt) : "همین حالا"}</span>
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-subtle px-2.5 py-1 text-xs text-muted">
                <span className="size-1.5 rounded-full bg-success" />
                ارسال‌شده
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ChannelTag() {
  return (
    <span className="inline-flex items-center gap-1 text-foreground">
      <MessageSquare className="size-3.5 text-faint" aria-hidden />
      پیامک
    </span>
  );
}
