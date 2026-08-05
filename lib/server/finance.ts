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
import { HttpError, notFound } from "./http";

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
  /** Pre-selected when requesting a withdrawal. */
  isDefault?: boolean;
  id: string;
  /** Full IR IBAN (`IR` + 24 digits). */
  iban: string;
  bankName: string;
  holder: string;
}

/**
 * `failed` was already excluded from the committed-funds filter while being
 * absent from this union — a state the code defended against and the types said
 * could not exist. It can now, because something finally sets these.
 */
export type WithdrawalStatus = "paid" | "processing" | "pending" | "failed";

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

  /**
   * A refunded order leaves `PAID` — so it is already absent from the paid
   * aggregate. Subtracting `refunds` from that total as well debited the
   * organiser twice: refunding ۲۰۰٬۰۰۰ moved `net` by ۳۹۴٬۰۰۰.
   *
   * The bug was unreachable while nothing could set `REFUNDED`, which is
   * exactly why it survived. It went live the moment refunds did.
   *
   * `gross` is now everything ever collected — paid *and* since refunded — so
   * the finance page can still say what came through the door, and `kept` is
   * what is actually the organiser's. The platform fee is charged on `kept`,
   * because taking a commission on money that was handed back is not a fee,
   * it is a penalty.
   */
  const kept = paid._sum.total ?? 0;
  const refunds = refunded._sum.total ?? 0;
  const gross = kept + refunds;
  const fee = Math.round(kept * PLATFORM_FEE_RATE);
  const net = Math.max(0, kept - fee);

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
    // Default first, so the withdrawal sheet's pre-selection is the head of
    // the list rather than whichever row the database returned first.
    bankAccounts: [...accounts]
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
      .map((a) => ({
        id: a.id,
        iban: a.iban,
        bankName: a.bankName,
        holder: a.holder,
        isDefault: a.isDefault,
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
  // The first account a workspace adds becomes the default; there is nothing
  // else to fall back to, and the withdrawal sheet needs a pre-selection.
  const existing = await db.bankAccount.count({ where: { workspaceId } });
  const row = await db.bankAccount.upsert({
    where: { workspaceId_iban: { workspaceId, iban: input.iban } },
    create: { workspaceId, ...input, isDefault: existing === 0 },
    update: { bankName: input.bankName, holder: input.holder },
  });
  return {
    id: row.id,
    iban: row.iban,
    bankName: row.bankName,
    holder: row.holder,
    isDefault: row.isDefault,
  };
}

/**
 * Remove a payout destination.
 *
 * Refused once it has been used: a withdrawal names the account it paid to, and
 * deleting that record would leave a financial trail pointing at nothing.
 */
export async function removeBankAccount(
  workspaceId: string,
  accountId: string,
): Promise<{ removed: boolean; reason?: string }> {
  const account = await db.bankAccount.findFirst({
    where: { id: accountId, workspaceId },
    select: { id: true, isDefault: true, _count: { select: { withdrawals: true } } },
  });
  if (!account) return { removed: false, reason: "حساب پیدا نشد." };
  if (account._count.withdrawals > 0) {
    return {
      removed: false,
      reason: "این حساب سابقه برداشت دارد و حذف نمی‌شود.",
    };
  }

  await db.bankAccount.delete({ where: { id: accountId } });

  // Never leave a workspace with accounts but no default.
  if (account.isDefault) {
    const next = await db.bankAccount.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (next) {
      await db.bankAccount.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }
  return { removed: true };
}

/** Exactly one default per workspace, swapped in a single transaction. */
export async function setDefaultBankAccount(
  workspaceId: string,
  accountId: string,
): Promise<{ ok: boolean }> {
  const account = await db.bankAccount.findFirst({
    where: { id: accountId, workspaceId },
    select: { id: true },
  });
  if (!account) return { ok: false };

  await db.$transaction([
    db.bankAccount.updateMany({
      where: { workspaceId },
      data: { isDefault: false },
    }),
    db.bankAccount.update({
      where: { id: accountId },
      data: { isDefault: true },
    }),
  ]);
  return { ok: true };
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

/** Statuses a payout may move to from its current one. */
const NEXT: Record<WithdrawalStatus, WithdrawalStatus[]> = {
  pending: ["processing", "paid", "failed"],
  processing: ["paid", "failed"],
  // Terminal. A settled payout that turns out to be wrong is a new
  // transaction, not an edit of the old one.
  paid: [],
  failed: [],
};

export interface PayoutRow {
  id: string;
  workspaceId: string;
  workspaceName: string;
  amount: Money;
  fee: Money;
  status: WithdrawalStatus;
  iban: string;
  bankName: string;
  holder: string;
  requestedAt: string;
  settledAt?: string;
}

/**
 * Every payout request across the platform, oldest first.
 *
 * Organisers could request a withdrawal and nothing could ever advance it:
 * `settledAt` was never written and no code path moved the status off
 * `"pending"`. The money was correctly withheld from their balance and then sat
 * in a state with no exit — a queue nobody could see and nobody could work.
 */
export async function listPayouts(
  status?: WithdrawalStatus,
): Promise<PayoutRow[]> {
  const rows = await db.withdrawal.findMany({
    where: status ? { status } : undefined,
    // Oldest first: a payout queue is worked in the order people joined it.
    orderBy: { createdAt: "asc" },
    include: {
      bankAccount: true,
      workspace: { select: { name: true } },
    },
  });

  return rows.map((w) => ({
    id: w.id,
    workspaceId: w.workspaceId,
    workspaceName: w.workspace.name,
    amount: w.amount,
    fee: w.fee,
    status: w.status as WithdrawalStatus,
    iban: w.bankAccount.iban,
    bankName: w.bankAccount.bankName,
    holder: w.bankAccount.holder,
    requestedAt: w.createdAt.toISOString(),
    settledAt: w.settledAt?.toISOString(),
  }));
}

/**
 * Advance a payout.
 *
 * The transition table is enforced rather than trusted: `paid` and `failed` are
 * terminal, so a double-click cannot re-settle a payout and a mistake cannot be
 * quietly rewritten into a different past.
 *
 * `failed` returns the money to the organiser's spendable balance, because
 * `computeFinance` counts every non-failed payout as committed — which is why
 * that filter existed before anything could produce the state.
 */
export async function settleWithdrawal(
  id: string,
  status: WithdrawalStatus,
): Promise<PayoutRow> {
  const current = await db.withdrawal.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!current) throw notFound("درخواست برداشت پیدا نشد.");

  const from = current.status as WithdrawalStatus;
  if (!NEXT[from]?.includes(status)) {
    throw new HttpError(
      409,
      "CONFLICT",
      from === status
        ? "این درخواست همین حالا در همین وضعیت است."
        : "این تغییر وضعیت مجاز نیست.",
    );
  }

  await db.withdrawal.update({
    where: { id },
    data: {
      status,
      // Stamped only when it actually reaches an end state.
      settledAt: status === "paid" || status === "failed" ? new Date() : null,
    },
  });

  const row = await db.withdrawal.findUniqueOrThrow({
    where: { id },
    include: { bankAccount: true, workspace: { select: { name: true } } },
  });
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    workspaceName: row.workspace.name,
    amount: row.amount,
    fee: row.fee,
    status: row.status as WithdrawalStatus,
    iban: row.bankAccount.iban,
    bankName: row.bankAccount.bankName,
    holder: row.bankAccount.holder,
    requestedAt: row.createdAt.toISOString(),
    settledAt: row.settledAt?.toISOString(),
  };
}
