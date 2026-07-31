/**
 * The payout queue.
 *
 * Withdrawals were created `"pending"` and nothing on the platform could ever
 * advance one: `settledAt` was never written and no code path touched the
 * status. The funds were correctly withheld from the organiser's balance and
 * then sat in a state with no exit.
 *
 * `computeFinance` already excluded `"failed"` payouts from committed funds —
 * defending against a state the type system said could not exist. It can now,
 * so the release path is tested here too.
 */

import { it, expect, beforeAll, afterAll, afterEach } from "vitest";

import { describeApi } from "./helpers";

let workspaceId = "";
let bankAccountId = "";
const created: string[] = [];
let madeAccount = false;
let fundingOrderId = "";
let fundingTypeId = "";

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");
  // A clean seed has no bank accounts: this used to find one only because the
  // finance suite left its own behind.
  const workspace = await db.workspace.findFirstOrThrow({ select: { id: true } });
  workspaceId = workspace.id;
  const account = await db.bankAccount.create({
    data: {
      workspaceId,
      iban: "IR000000000000000000008888",
      bankName: "بانک آزمون برداشت",
      holder: "آزمون",
      isDefault: false,
    },
    select: { id: true },
  });
  bankAccountId = account.id;
  madeAccount = true;

  /**
   * Revenue to withhold from.
   *
   * `balance` is `max(0, net − committed)`, so a workspace with no sales
   * clamps to zero and every "this payout reduced the balance" assertion
   * silently compares 0 to 0. The suite previously had a balance only because
   * other suites' paid orders were left in the database.
   */
  const now = new Date();
  const type = await db.ticketType.findFirst({
    where: {
      price: { gt: 0 },
      salesStartAt: { lte: now },
      salesEndAt: { gte: now },
      sectionPricing: { none: {} },
      event: { workspaceId, status: "PUBLISHED", requiresApproval: false },
    },
    orderBy: { id: "asc" },
    select: { id: true, eventId: true },
  });
  if (type) {
    const { createOrder, markOrderPaid } = await import("@/lib/server/orders");
    const placed = await createOrder({
      eventId: type.eventId,
      items: [{ ticketTypeId: type.id, quantity: 10 }],
      buyerName: "آزمون موجودی",
      buyerPhone: "09121119200",
    });
    await markOrderPaid(placed.order.id, {
      provider: "mock",
      authority: `po-${placed.order.id}`,
    });
    fundingOrderId = placed.order.id;
    fundingTypeId = type.id;
  }
});

afterAll(async () => {
  if (!madeAccount) return;
  const { db } = await import("@/lib/server/db");
  await db.withdrawal.deleteMany({ where: { bankAccountId } });
  await db.bankAccount.deleteMany({ where: { id: bankAccountId } });

  if (fundingOrderId) {
    await db.ticket.deleteMany({ where: { orderId: fundingOrderId } });
    await db.orderItem.deleteMany({ where: { orderId: fundingOrderId } });
    await db.payment.deleteMany({ where: { orderId: fundingOrderId } });
    await db.order.deleteMany({ where: { id: fundingOrderId } });
    await db.ticketType.update({
      where: { id: fundingTypeId },
      data: { sold: { decrement: 10 } },
    });
    await db.attendee.deleteMany({ where: { phone: "09121119200" } });
  }
});

afterEach(async () => {
  if (!bankAccountId) return;
  const { db } = await import("@/lib/server/db");
  /**
   * By bank account, not by the ids this suite remembered.
   *
   * A test that dies part-way — one timed out at 5 s on a stalled query — can
   * leave a row the `created` list never saw, and the next test's balance
   * assertion then fails by exactly the stray amount. Deleting everything
   * attached to this suite's own account cannot miss one, and the account
   * belongs to nobody else.
   */
  await db.withdrawal.deleteMany({ where: { bankAccountId } });
  created.length = 0;
});

async function payout(amount = 50_000) {
  const { db } = await import("@/lib/server/db");
  const row = await db.withdrawal.create({
    data: { workspaceId, bankAccountId, amount, fee: 5_000, status: "pending" },
    select: { id: true },
  });
  created.push(row.id);
  return row.id;
}

describeApi("payout queue", () => {
  it("moves a pending payout to paid and stamps when", async () => {
    const { settleWithdrawal } = await import("@/lib/server/finance");
    const id = await payout();

    const result = await settleWithdrawal(id, "paid");

    expect(result.status).toBe("paid");
    // `settledAt` existed as a column that nothing ever wrote.
    expect(result.settledAt).toBeTruthy();
  });

  it("stamps nothing while a payout is merely in progress", async () => {
    const { settleWithdrawal } = await import("@/lib/server/finance");
    const id = await payout();

    const result = await settleWithdrawal(id, "processing");

    expect(result.status).toBe("processing");
    expect(result.settledAt).toBeUndefined();
  });

  it("refuses to re-settle a paid payout", async () => {
    const { settleWithdrawal } = await import("@/lib/server/finance");
    const id = await payout();
    await settleWithdrawal(id, "paid");

    // Terminal. A double-click must not rewrite a settled transfer, and a
    // payout that turns out to be wrong is a new transaction, not an edit.
    await expect(settleWithdrawal(id, "failed")).rejects.toThrow();
    await expect(settleWithdrawal(id, "paid")).rejects.toThrow();
  });

  it("never moves a payout backwards into the queue", async () => {
    const { settleWithdrawal } = await import("@/lib/server/finance");
    const id = await payout();
    await settleWithdrawal(id, "processing");

    await expect(
      settleWithdrawal(id, "pending" as "processing"),
    ).rejects.toThrow();
  });

  it("holds a pending payout against the spendable balance", async () => {
    const { computeFinance } = await import("@/lib/server/finance");

    const before = await computeFinance(workspaceId);
    const id = await payout(30_000);
    const after = await computeFinance(workspaceId);

    // amount + fee, both committed the moment the request is made.
    expect(before.balance - after.balance).toBe(35_000);
    void id;
  });

  it("returns the money when a transfer fails", async () => {
    const { computeFinance, settleWithdrawal } = await import(
      "@/lib/server/finance"
    );

    const before = await computeFinance(workspaceId);
    const id = await payout(30_000);
    await settleWithdrawal(id, "failed");
    const after = await computeFinance(workspaceId);

    // The bank rejected it, so the organiser can spend it again.
    expect(after.balance).toBe(before.balance);
  });

  it("keeps a paid payout committed", async () => {
    const { computeFinance, settleWithdrawal } = await import(
      "@/lib/server/finance"
    );

    const before = await computeFinance(workspaceId);
    const id = await payout(30_000);
    await settleWithdrawal(id, "paid");
    const after = await computeFinance(workspaceId);

    // The money left. It must not reappear as spendable.
    expect(before.balance - after.balance).toBe(35_000);
  });

  it("lists oldest first — a queue is worked in order", async () => {
    const { listPayouts } = await import("@/lib/server/finance");
    await payout(11_000);
    await payout(12_000);

    const rows = await listPayouts();
    const times = rows.map((r) => new Date(r.requestedAt).getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("filters by status", async () => {
    const { listPayouts, settleWithdrawal } = await import(
      "@/lib/server/finance"
    );
    const id = await payout();
    await settleWithdrawal(id, "processing");

    const processing = await listPayouts("processing");
    expect(processing.some((p) => p.id === id)).toBe(true);
    expect((await listPayouts("pending")).some((p) => p.id === id)).toBe(false);
  });

  it("refuses an anonymous caller — this exposes every organiser's IBAN", async () => {
    const { GET } = await import("@/app/api/admin/payouts/route");
    const { req } = await import("./helpers");

    const res = await GET(req("GET", "/api/admin/payouts"));
    expect([401, 403]).toContain(res.status);
  });
});
