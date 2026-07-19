/**
 * Marketing campaign data-access + audience segments over the in-memory store.
 * Replace with real campaign/segment queries when a datastore is added.
 */

import type { Campaign } from "@/types";

import { attendees } from "./store";

const campaigns: Campaign[] = [
  {
    id: "cmp10000-0000-4000-8000-000000000001",
    name: "یادآوری کنسرت همایون شجریان",
    channel: "sms",
    segment: "همه مخاطبان",
    status: "sent",
    recipients: 3,
    message: "کنسرت همایون شجریان، ۲۳ مرداد در برج میلاد. بلیت‌ها رو به اتمام است.",
    sentAt: "2026-07-15T10:00:00.000Z",
  },
  {
    id: "cmp10000-0000-4000-8000-000000000002",
    name: "تخفیف زودهنگام همایش استارتاپی",
    channel: "email",
    segment: "برگزارکننده",
    status: "sent",
    recipients: 1,
    message: "با کد EARLY تا پایان هفته از تخفیف بلیت زودهنگام بهره‌مند شوید.",
    sentAt: "2026-07-10T08:30:00.000Z",
  },
];

export function listCampaigns(): Campaign[] {
  return [...campaigns];
}

export interface Segment {
  id: string;
  label: string;
  count: number;
}

/** Audience segments derived from attendee tags (plus an "all" segment). */
export function listSegments(): Segment[] {
  const byTag = new Map<string, number>();
  for (const a of attendees) {
    for (const tag of a.tags) {
      byTag.set(tag.label, (byTag.get(tag.label) ?? 0) + 1);
    }
  }
  return [
    { id: "all", label: "همه مخاطبان", count: attendees.length },
    ...[...byTag.entries()].map(([label, count]) => ({
      id: label,
      label,
      count,
    })),
  ];
}
