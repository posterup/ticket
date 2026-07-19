/**
 * Illustrative finance figures derived deterministically from the mock ticket
 * data (and the same analytics revenue). Sample data - replace with real order
 * and settlement records when payments land.
 */

import { listTickets, getEventById } from "@/lib/server";
import { computeAnalytics } from "@/lib/analytics/compute";

const PLATFORM_FEE_RATE = 0.03;
const BASE_DATE = new Date("2026-07-18T12:00:00.000Z").getTime();
const DAY = 86_400_000;

const BUYERS = [
  "سارا محمدی",
  "امیرحسین رضایی",
  "نگار کریمی",
  "محمد حسینی",
  "زهرا احمدی",
  "علی موسوی",
  "فاطمه کاظمی",
  "رضا نجفی",
  "مریم صادقی",
  "حسین علوی",
];

export type TxStatus = "paid" | "refunded";

export interface Transaction {
  id: string;
  buyer: string;
  event: string;
  amount: number;
  status: TxStatus;
  date: string;
}

export interface Settlement {
  id: string;
  date: string;
  amount: number;
  status: "paid" | "pending";
}

export interface Finance {
  gross: number;
  fee: number;
  refunds: number;
  net: number;
  pendingSettlement: number;
  transactions: Transaction[];
  settlements: Settlement[];
}

export function computeFinance(): Finance {
  const gross = computeAnalytics().revenue;
  const tickets = listTickets();

  const transactions: Transaction[] = BUYERS.map((buyer, i) => {
    const t = tickets[i % Math.max(1, tickets.length)];
    const event = t ? getEventById(t.eventId)?.title ?? "رویداد" : "رویداد";
    const status: TxStatus = i % 7 === 3 ? "refunded" : "paid";
    return {
      id: `tx-${i + 1}`,
      buyer,
      event,
      amount: t?.price ?? 0,
      status,
      date: new Date(BASE_DATE - i * DAY).toISOString(),
    };
  });

  const refunds = transactions
    .filter((t) => t.status === "refunded")
    .reduce((s, t) => s + t.amount, 0);
  const fee = Math.round(gross * PLATFORM_FEE_RATE);
  const net = gross - fee - refunds;
  const pendingSettlement = Math.round(net * 0.35);

  const settlements: Settlement[] = [
    {
      id: "st-1",
      date: new Date(BASE_DATE - 2 * DAY).toISOString(),
      amount: Math.round(net * 0.4),
      status: "paid",
    },
    {
      id: "st-2",
      date: new Date(BASE_DATE - 32 * DAY).toISOString(),
      amount: Math.round(net * 0.25),
      status: "paid",
    },
    {
      id: "st-3",
      date: new Date(BASE_DATE + 5 * DAY).toISOString(),
      amount: pendingSettlement,
      status: "pending",
    },
  ];

  return { gross, fee, refunds, net, pendingSettlement, transactions, settlements };
}
