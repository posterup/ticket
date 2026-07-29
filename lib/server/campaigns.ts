/**
 * Marketing campaign data-access and audience segments over Postgres.
 *
 * Segments are derived from CRM tags rather than stored: a tag *is* a segment,
 * so there is nothing to keep in sync.
 */

import type { Campaign } from "@/types";

import { db } from "./db";
import { toCampaign } from "./mappers";

export async function listCampaigns(): Promise<Campaign[]> {
  const rows = await db.campaign.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map(toCampaign);
}

export interface Segment {
  id: string;
  label: string;
  count: number;
}

/** Mobile numbers for a segment (for the SMS gateway). */
export async function segmentMobiles(segmentId: string): Promise<string[]> {
  const rows = await db.attendee.findMany({
    where:
      segmentId === "all"
        ? undefined
        : { tags: { some: { tag: { label: segmentId } } } },
    select: { phone: true },
  });
  return rows.map((r) => r.phone);
}

/** Audience segments derived from attendee tags (plus an "all" segment). */
export async function listSegments(): Promise<Segment[]> {
  const [total, tags] = await Promise.all([
    db.attendee.count(),
    db.attendeeTag.findMany({
      select: { label: true, _count: { select: { links: true } } },
    }),
  ]);

  return [
    { id: "all", label: "همه مخاطبان", count: total },
    ...tags
      .filter((t) => t._count.links > 0)
      .map((t) => ({ id: t.label, label: t.label, count: t._count.links })),
  ];
}
