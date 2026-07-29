/**
 * Illustrative finance figures derived deterministically from the mock ticket
 * data (and the same analytics revenue). Sample data - replace with real order
 * and settlement records when payments land.
 */

import { listTickets, listEvents } from "@/lib/server";
import { computeAnalytics } from "@/lib/analytics/compute";

const PLATFORM_FEE_RATE = 0.03;
/** Flat fee (Toman) charged on each wallet withdrawal. */
export const WITHDRAW_FEE = 5_000;
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

/** A saved IR bank account (شبا/IBAN) a withdrawal can be paid to. */
export interface BankAccount {
  id: string;
  /** Full IR IBAN (`IR` + 24 digits). */
  iban: string;
  bankName: string;
  /** Account holder name as registered with the bank. */
  holder: string;
}

export type WithdrawalStatus = "paid" | "processing" | "pending";

/** A wallet withdrawal request paid out to a {@link BankAccount}. */
export interface Withdrawal {
  id: string;
  /** Requested amount (Toman), before the withdrawal fee. */
  amount: number;
  /** Flat withdrawal fee applied (Toman). */
  fee: number;
  iban: string;
  bankName: string;
  status: WithdrawalStatus;
  date: string;
}

export interface Finance {
  gross: number;
  fee: number;
  refunds: number;
  net: number;
  pendingSettlement: number;
  /** Spendable balance held in the پوستر wallet (Toman). */
  balance: number;
  transactions: Transaction[];
  settlements: Settlement[];
  bankAccounts: BankAccount[];
  withdrawals: Withdrawal[];
}

export async function computeFinance(): Promise<Finance> {
  const gross = (await computeAnalytics()).revenue;
  const tickets = await listTickets();

  // Resolve every referenced event title up front rather than per row.
  const titles = new Map(
    (await listEvents()).map((e) => [e.id, e.title] as const),
  );

  const transactions: Transaction[] = BUYERS.map((buyer, i) => {
    const t = tickets[i % Math.max(1, tickets.length)];
    const event = t ? titles.get(t.eventId) ?? "رویداد" : "رویداد";
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

  const bankAccounts: BankAccount[] = [
    {
      id: "ba-1",
      iban: "IR820540102680020817909002",
      bankName: "بانک پارسیان",
      holder: "مدیر رویداد",
    },
    {
      id: "ba-2",
      iban: "IR062960000000100324200001",
      bankName: "بانک ملت",
      holder: "مدیر رویداد",
    },
  ];

  // A couple of past payouts, plus the wallet balance left after them.
  const withdrawals: Withdrawal[] = [
    {
      id: "wd-1",
      amount: Math.round(net * 0.3),
      fee: WITHDRAW_FEE,
      iban: bankAccounts[0].iban,
      bankName: bankAccounts[0].bankName,
      status: "paid",
      date: new Date(BASE_DATE - 6 * DAY).toISOString(),
    },
    {
      id: "wd-2",
      amount: Math.round(net * 0.15),
      fee: WITHDRAW_FEE,
      iban: bankAccounts[1].iban,
      bankName: bankAccounts[1].bankName,
      status: "processing",
      date: new Date(BASE_DATE - 1 * DAY).toISOString(),
    },
  ];
  const withdrawn = withdrawals.reduce((s, w) => s + w.amount + w.fee, 0);
  const balance = Math.max(0, net - withdrawn);

  return {
    gross,
    fee,
    refunds,
    net,
    pendingSettlement,
    balance,
    transactions,
    settlements,
    bankAccounts,
    withdrawals,
  };
}
