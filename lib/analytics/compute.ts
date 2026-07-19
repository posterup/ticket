/**
 * Illustrative analytics derived deterministically from the mock ticket data.
 * "Sold" counts are estimated from capacity via a fixed per-category ratio, so
 * the numbers are sample data - not real sales. Replace with real order data
 * when the datastore lands.
 */

import { listTickets } from "@/lib/server";
import { CATEGORY_LABELS } from "@/lib/wizard/labels";
import type { TicketCategory } from "@/types";

const SELL_RATIO: Record<TicketCategory, number> = {
  general: 0.62,
  vip: 0.48,
  student: 0.71,
  "early-bird": 0.85,
  backstage: 0.4,
  group: 0.55,
};

// Fixed weights across the last six Jalali months (sample seasonality).
const MONTH_LABELS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
];
const MONTH_WEIGHTS = [0.8, 1.0, 1.25, 1.05, 1.5, 1.35];

export interface CategoryStat {
  category: TicketCategory;
  label: string;
  sold: number;
  revenue: number;
}

export interface Analytics {
  revenue: number;
  ticketsSold: number;
  capacity: number;
  conversion: number;
  avgPrice: number;
  byCategory: CategoryStat[];
  monthly: { label: string; value: number }[];
}

export function computeAnalytics(): Analytics {
  const tickets = listTickets();
  let revenue = 0;
  let ticketsSold = 0;
  let capacity = 0;
  const byCat = new Map<TicketCategory, { sold: number; revenue: number }>();

  for (const t of tickets) {
    const sold = Math.round(t.capacity * (SELL_RATIO[t.category] ?? 0.5));
    const rev = sold * t.price;
    revenue += rev;
    ticketsSold += sold;
    capacity += t.capacity;
    const prev = byCat.get(t.category) ?? { sold: 0, revenue: 0 };
    byCat.set(t.category, { sold: prev.sold + sold, revenue: prev.revenue + rev });
  }

  const byCategory: CategoryStat[] = [...byCat.entries()]
    .map(([category, v]) => ({
      category,
      label: CATEGORY_LABELS[category],
      sold: v.sold,
      revenue: v.revenue,
    }))
    .sort((a, b) => b.sold - a.sold);

  const weightSum = MONTH_WEIGHTS.reduce((s, w) => s + w, 0);
  const monthly = MONTH_LABELS.map((label, i) => ({
    label,
    value: Math.round((revenue * MONTH_WEIGHTS[i]) / weightSum),
  }));

  return {
    revenue,
    ticketsSold,
    capacity,
    conversion: capacity ? ticketsSold / capacity : 0,
    avgPrice: ticketsSold ? Math.round(revenue / ticketsSold) : 0,
    byCategory,
    monthly,
  };
}
