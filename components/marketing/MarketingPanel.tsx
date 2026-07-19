"use client";

import { useState } from "react";
import { Mail, MessageSquare, Check, Send } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber, formatJalaliDate } from "@/lib/format";
import type { Campaign, CampaignChannel } from "@/types";
import type { Segment } from "@/lib/server/campaigns";

const CHANNELS: { value: CampaignChannel; label: string }[] = [
  { value: "sms", label: "پیامک" },
  { value: "email", label: "ایمیل" },
];

export function MarketingPanel({
  seedCampaigns,
  segments,
}: {
  seedCampaigns: Campaign[];
  segments: Segment[];
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(seedCampaigns);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>("sms");
  const [segmentId, setSegmentId] = useState(segments[0]?.id ?? "all");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sentInfo, setSentInfo] = useState<string | null>(null);

  const segment = segments.find((s) => s.id === segmentId) ?? segments[0];
  const parts = Math.max(1, Math.ceil(message.length / 70));

  function send() {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "نام کمپین الزامی است.";
    if (!message.trim()) next.message = "متن پیام الزامی است.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const campaign: Campaign = {
      id: crypto.randomUUID(),
      name: name.trim(),
      channel,
      segment: segment.label,
      status: "sent",
      recipients: segment.count,
      message: message.trim(),
    };
    setCampaigns((prev) => [campaign, ...prev]);
    setSentInfo(`کمپین «${campaign.name}» به ${formatNumber(segment.count)} مخاطب ارسال شد.`);
    setName("");
    setMessage("");
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

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">کانال</span>
          <div className="grid grid-cols-2 gap-2">
            {CHANNELS.map((c) => (
              <button
                key={c.value}
                type="button"
                aria-pressed={channel === c.value}
                onClick={() => setChannel(c.value)}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/15",
                  channel === c.value
                    ? "border-foreground bg-subtle text-foreground"
                    : "border-border text-muted hover:border-border-strong",
                )}
              >
                {c.value === "sms" ? (
                  <MessageSquare className="size-4" aria-hidden />
                ) : (
                  <Mail className="size-4" aria-hidden />
                )}
                {c.label}
              </button>
            ))}
          </div>
        </div>

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
          hint={
            channel === "sms"
              ? `${formatNumber(message.length)} کاراکتر · ${formatNumber(parts)} پیامک`
              : `${formatNumber(message.length)} کاراکتر`
          }
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

        <Button type="button" onClick={send}>
          <Send aria-hidden />
          ارسال به {formatNumber(segment?.count ?? 0)} مخاطب
        </Button>

        {sentInfo ? (
          <p className="flex items-center gap-2 text-sm text-success">
            <Check className="size-4" aria-hidden />
            {sentInfo}
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
                  <ChannelTag channel={c.channel} />
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

function ChannelTag({ channel }: { channel: CampaignChannel }) {
  return (
    <span className="inline-flex items-center gap-1 text-foreground">
      {channel === "sms" ? (
        <MessageSquare className="size-3.5 text-faint" aria-hidden />
      ) : (
        <Mail className="size-3.5 text-faint" aria-hidden />
      )}
      {channel === "sms" ? "پیامک" : "ایمیل"}
    </span>
  );
}
