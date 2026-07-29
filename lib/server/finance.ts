/**
 * Workspace finance, from real orders.
 *
 * Everything here used to be fabricated: `sold` was estimated as
 * `capacity × SELL_RATIO[category]`, revenue was derived from that estimate,
 * and the buyers, settlements, bank accounts and withdrawals were literals in
 * the source. Orders exist now, so the numbers are aggregates over them.
 *
 * All amounts are integer Toman.
 */

import type { Money } from "@/types";

import { db } from "./db";

/** Platform commission on gross sales. */
const PLATFORM_FEE_RATE = 0.03;
/** Flat fee charged on each wallet withdrawal. */
export const WITHDRAW_FEE = 5_000;

export type TxStatus = "paid" | "refunded";

export interface Transaction {
  id: string;
  buyer: string;
  event: string;
  amount: Money;
  status: TxStatus;
  date: string;
}

export interface BankAccount {
  id: string;
  /** Full IR IBAN (`IR` + 24 digits). */
  iban: string;
  bankName: string;
  holder: string;
}

export type WithdrawalStatus = "paid" | "processing" | "pending";

export interface Withdrawal {
  id: string;
  amount: Money;
  fee: Money;
  iban: string;
  bankName: string;
  status: WithdrawalStatus;
  date: string;
}

export interface Finance {
  gross: Money;
  fee: Money;
  refunds: Money;
  net: Money;
  /** Spendable balance held in the پوستر wallet. */
  balance: Money;
  transactions: Transaction[];
  bankAccounts: BankAccount[];
  withdrawals: Withdrawal[];
}

/** Recent orders for a workspace, newest first. */
async function recentTransactions(
  workspaceId: string,
  take = 20,
): Promise<Transaction[]> {
  const rows = await db.order.findMany({
    where: {
      event: { workspaceId },
      status: { in: ["PAID", "REFUNDED"] },
    },
    select: {
      id: true,
      buyerName: true,
      total: true,
      status: true,
      paidAt: true,
      createdAt: true,
      event: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  return rows.map((o) => ({
    id: o.id,
    buyer: o.buyerName,
    event: o.event.title,
    amount: o.total,
    status: o.status === "REFUNDED" ? "refunded" : "paid",
    date: (o.paidAt ?? o.createdAt).toISOString(),
  }));
}

/** The workspace's money, as the finance page shows it. */
export async function computeFinance(workspaceId: string): Promise<Finance> {
  const [paid, refunded, accounts, payouts, transactions] = await Promise.all([
    db.order.aggregate({
      where: { event: { workspaceId }, status: "PAID" },
      _sum: { total: true },
    }),
    db.order.aggregate({
      where: { event: { workspaceId }, status: "REFUNDED" },
      _sum: { total: true },
    }),
    db.bankAccount.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
    }),
    db.withdrawal.findMany({
      where: { workspaceId },
      include: { bankAccount: true },
      orderBy: { createdAt: "desc" },
    }),
    recentTransactions(workspaceId),
  ]);

  const gross = paid._sum.total ?? 0;
  const refunds = refunded._sum.total ?? 0;
  const fee = Math.round(gross * PLATFORM_FEE_RATE);
  const net = Math.max(0, gross - fee - refunds);

  // Anything not already paid out or in flight is still spendable.
  const committed = payouts
    .filter((w) => w.status !== "failed")
    .reduce((sum, w) => sum + w.amount + w.fee, 0);

  return {
    gross,
    fee,
    refunds,
    net,
    balance: Math.max(0, net - committed),
    transactions,
    bankAccounts: accounts.map((a) => ({
      id: a.id,
      iban: a.iban,
      bankName: a.bankName,
      holder: a.holder,
    })),
    withdrawals: payouts.map((w) => ({
      id: w.id,
      amount: w.amount,
      fee: w.fee,
      iban: w.bankAccount.iban,
      bankName: w.bankAccount.bankName,
      status: w.status as WithdrawalStatus,
      date: w.createdAt.toISOString(),
    })),
  };
}

/**
 * Save a payout destination.
 *
 * Idempotent on the IBAN: re-adding a destination the workspace already has
 * updates its label rather than failing on the uniqueness constraint, which a
 * caller experiences as an unexplained error.
 */
export async function addBankAccount(
  workspaceId: string,
  input: { iban: string; bankName: string; holder: string },
): Promise<BankAccount> {
  const row = await db.bankAccount.upsert({
    where: { workspaceId_iban: { workspaceId, iban: input.iban } },
    create: { workspaceId, ...input },
    update: { bankName: input.bankName, holder: input.holder },
  });
  return {
    id: row.id,
    iban: row.iban,
    bankName: row.bankName,
    holder: row.holder,
  };
}

export type WithdrawOutcome =
  | { ok: true; withdrawal: Withdrawal; balance: Money }
  | { ok: false; reason: "no-account" | "insufficient"; message: string };

/**
 * Request a payout.
 *
 * The balance is recomputed here rather than trusted from the client, and the
 * fee is added on top of the requested amount — a withdrawal that would
 * overdraw the wallet is refused rather than left to settle negative.
 */
export async function requestWithdrawal(
  workspaceId: string,
  input: { amount: Money; bankAccountId: string },
  requestedByUserId: string,
): Promise<WithdrawOutcome> {
  const account = await db.bankAccount.findFirst({
    where: { id: input.bankAccountId, workspaceId },
  });
  if (!account) {
    return {
      ok: false,
      reason: "no-account",
      message: "حساب بانکی یافت نشد.",
    };
  }

  const { balance } = await computeFinance(workspaceId);
  if (input.amount + WITHDRAW_FEE > balance) {
    return {
      ok: false,
      reason: "insufficient",
      message: "موجودی کافی نیست.",
    };
  }

  const row = await db.withdrawal.create({
    data: {
      workspaceId,
      bankAccountId: account.id,
      amount: input.amount,
      fee: WITHDRAW_FEE,
      status: "pending",
      requestedByUserId,
    },
  });

  return {
    ok: true,
    withdrawal: {
      id: row.id,
      amount: row.amount,
      fee: row.fee,
      iban: account.iban,
      bankName: account.bankName,
      status: "pending",
      date: row.createdAt.toISOString(),
    },
    balance: balance - input.amount - WITHDRAW_FEE,
  };
}
