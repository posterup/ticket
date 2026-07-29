import { it, expect, beforeAll } from "vitest";

import { GET as FINANCE } from "@/app/api/workspaces/[slug]/finance/route";
import { POST as ADD_ACCOUNT } from "@/app/api/workspaces/[slug]/bank-accounts/route";
import { POST as WITHDRAW } from "@/app/api/workspaces/[slug]/withdrawals/route";
import { PATCH as PATCH_ME } from "@/app/api/me/route";
import { DELETE as DELETE_EVENT } from "@/app/api/events/[id]/route";
import { POST as CREATE_ORDER } from "@/app/api/orders/route";
import type { Finance } from "@/lib/server/finance";
import type { Order } from "@/types";

import {
  ctx,
  data,
  describeApi,
  errorCode,
  parse,
  req,
  signInAs,
  signInAsOwner,
  signOut,
} from "./helpers";

const AVA = "ava-events";
const AVA_OWNER = "09120000001";
const NEGAR_OWNER = "09120000002";

const IBAN = "IR820540102680020817909002";

/** A published event owned by ava-events, optionally with a sale on it. */
async function eventWithSale(total: number) {
  const { db } = await import("@/lib/server/db");
  const workspace = await db.workspace.findFirstOrThrow({
    where: { slug: AVA },
    select: { id: true },
  });
  const venue = await db.venue.create({
    data: { name: "تالار", city: "تهران", address: "نشانی", capacity: 50 },
  });
  const event = await db.event.create({
    data: {
      workspaceId: workspace.id,
      venueId: venue.id,
      title: "رویداد مالی",
      description: "",
      mode: "ONE_TIME",
      status: "PUBLISHED",
    },
  });
  const type = await db.ticketType.create({
    data: {
      eventId: event.id,
      name: "عادی",
      price: total,
      capacity: 10,
      salesStartAt: new Date("2020-01-01T00:00:00.000Z"),
      salesEndAt: new Date("2030-01-01T00:00:00.000Z"),
      category: "GENERAL",
    },
  });

  if (total > 0) {
    await signOut();
    const { order } = data(
      await parse<{ order: Order }>(
        await CREATE_ORDER(
          req("POST", "/", {
            eventId: event.id,
            items: [{ ticketTypeId: type.id, quantity: 1 }],
            buyerName: "سارا محمدی",
            buyerPhone: "09121234567",
          }),
        ),
      ),
    );
    const { markOrderPaid } = await import("@/lib/server/orders");
    await markOrderPaid(order.id, { provider: "mock" });
    await signInAs(AVA_OWNER);
  }

  return { eventId: event.id, workspaceId: workspace.id };
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");
  // Payouts accumulate across runs and would skew the balance.
  await db.withdrawal.deleteMany();
  await db.bankAccount.deleteMany();
  await signInAsOwner();
});

describeApi("GET /api/workspaces/:slug/finance", () => {
  it("counts real paid orders, not estimates", async () => {
    const before = data(
      await parse<Finance>(await FINANCE(req("GET", "/"), ctx({ slug: AVA }))),
    );
    await eventWithSale(500_000);
    const after = data(
      await parse<Finance>(await FINANCE(req("GET", "/"), ctx({ slug: AVA }))),
    );

    // Gross moves by exactly the order total. It used to be
    // capacity × SELL_RATIO[category], which no sale could ever change.
    expect(after.gross).toBe(before.gross + 500_000);
    expect(after.transactions[0].amount).toBe(500_000);
    expect(after.transactions[0].buyer).toBe("سارا محمدی");
  });

  it("takes the platform fee out of net", async () => {
    const f = data(
      await parse<Finance>(await FINANCE(req("GET", "/"), ctx({ slug: AVA }))),
    );
    expect(f.fee).toBe(Math.round(f.gross * 0.03));
    expect(f.net).toBe(Math.max(0, f.gross - f.fee - f.refunds));
  });

  it("refuses another workspace's owner", async () => {
    await signInAs(NEGAR_OWNER);
    const parsed = await parse(await FINANCE(req("GET", "/"), ctx({ slug: AVA })));
    expect(parsed.status).toBe(403);
    await signInAs(AVA_OWNER);
  });

  it("refuses an anonymous caller", async () => {
    await signOut();
    const parsed = await parse(await FINANCE(req("GET", "/"), ctx({ slug: AVA })));
    expect(parsed.status).toBe(401);
    await signInAs(AVA_OWNER);
  });

  it("404s an unknown workspace", async () => {
    const parsed = await parse(await FINANCE(req("GET", "/"), ctx({ slug: "nope" })));
    expect(parsed.status).toBe(404);
  });
});

describeApi("bank accounts and withdrawals", () => {
  async function addAccount() {
    return data(
      await parse<{ id: string }>(
        await ADD_ACCOUNT(
          req("POST", "/", {
            iban: IBAN,
            bankName: "بانک پارسیان",
            holder: "مدیر رویداد",
          }),
          ctx({ slug: AVA }),
        ),
      ),
    );
  }

  it("saves a payout destination", async () => {
    const account = await addAccount();
    expect(account.id).toBeTruthy();

    const f = data(
      await parse<Finance>(await FINANCE(req("GET", "/"), ctx({ slug: AVA }))),
    );
    expect(f.bankAccounts.map((a) => a.iban)).toContain(IBAN);
  });

  it("rejects a malformed IBAN", async () => {
    for (const iban of ["IR123", "820540102680020817909002", "XX820540102680020817909002"]) {
      const parsed = await parse(
        await ADD_ACCOUNT(
          req("POST", "/", { iban, bankName: "ب", holder: "ح" }),
          ctx({ slug: AVA }),
        ),
      );
      expect(parsed.status).toBe(400);
    }
  });

  it("pays out against the balance and reduces it", async () => {
    await eventWithSale(2_000_000);
    const account = await addAccount();
    const before = data(
      await parse<Finance>(await FINANCE(req("GET", "/"), ctx({ slug: AVA }))),
    );

    const parsed = await parse<{ balance: number }>(
      await WITHDRAW(
        req("POST", "/", { amount: 100_000, bankAccountId: account.id }),
        ctx({ slug: AVA }),
      ),
    );
    expect(parsed.status).toBe(201);

    const after = data(
      await parse<Finance>(await FINANCE(req("GET", "/"), ctx({ slug: AVA }))),
    );
    // The flat fee comes out on top of the requested amount.
    expect(after.balance).toBe(before.balance - 100_000 - 5_000);
    expect(after.withdrawals[0].amount).toBe(100_000);
  });

  it("refuses a withdrawal that would overdraw the wallet", async () => {
    const account = await addAccount();
    const f = data(
      await parse<Finance>(await FINANCE(req("GET", "/"), ctx({ slug: AVA }))),
    );

    const parsed = await parse(
      await WITHDRAW(
        req("POST", "/", {
          amount: f.balance + 1,
          bankAccountId: account.id,
        }),
        ctx({ slug: AVA }),
      ),
    );
    expect(parsed.status).toBe(409);
    expect(errorCode(parsed)).toBe("CONFLICT");
  });

  it("404s a bank account belonging to another workspace", async () => {
    const parsed = await parse(
      await WITHDRAW(
        req("POST", "/", { amount: 1_000, bankAccountId: "nope" }),
        ctx({ slug: AVA }),
      ),
    );
    expect(parsed.status).toBe(404);
  });

  it("refuses an anonymous caller a payout", async () => {
    await signOut();
    const parsed = await parse(
      await WITHDRAW(
        req("POST", "/", { amount: 1_000, bankAccountId: "x" }),
        ctx({ slug: AVA }),
      ),
    );
    expect(parsed.status).toBe(401);
    await signInAs(AVA_OWNER);
  });
});

describeApi("PATCH /api/me", () => {
  it("sets the caller's own name", async () => {
    await signInAs("09191112233");
    const parsed = await parse<{ fullName: string | null }>(
      await PATCH_ME(req("PATCH", "/", { fullName: "کاربر تازه" })),
    );
    expect(parsed.status).toBe(200);
    expect(data(parsed).fullName).toBe("کاربر تازه");
  });

  it("clears an email with an empty string", async () => {
    await PATCH_ME(req("PATCH", "/", { email: "a@example.com" }));
    const cleared = await parse(await PATCH_ME(req("PATCH", "/", { email: "" })));
    expect(cleared.status).toBe(200);

    const { db } = await import("@/lib/server/db");
    const user = await db.user.findUniqueOrThrow({ where: { phone: "09191112233" } });
    expect(user.email).toBeNull();
  });

  it("409s an email another account already holds", async () => {
    await PATCH_ME(req("PATCH", "/", { email: "taken@example.com" }));

    await signInAs("09194445566");
    const parsed = await parse(
      await PATCH_ME(req("PATCH", "/", { email: "taken@example.com" })),
    );
    // A unique-constraint collision must be a clear conflict, not a 500.
    expect(parsed.status).toBe(409);
    expect(errorCode(parsed)).toBe("DUPLICATE");
  });

  it("rejects an empty patch and a malformed email", async () => {
    expect((await parse(await PATCH_ME(req("PATCH", "/", {})))).status).toBe(400);
    expect(
      (await parse(await PATCH_ME(req("PATCH", "/", { email: "nope" })))).status,
    ).toBe(400);
  });

  it("refuses an anonymous caller", async () => {
    await signOut();
    expect(
      (await parse(await PATCH_ME(req("PATCH", "/", { fullName: "x" })))).status,
    ).toBe(401);
    await signInAs(AVA_OWNER);
  });
});

describeApi("DELETE /api/events/:id", () => {
  it("deletes an event that has sold nothing", async () => {
    const { eventId } = await eventWithSale(0);
    const parsed = await parse<{ id: string }>(
      await DELETE_EVENT(req("DELETE", "/"), ctx({ id: eventId })),
    );
    expect(parsed.status).toBe(200);

    const { db } = await import("@/lib/server/db");
    expect(await db.event.findUnique({ where: { id: eventId } })).toBeNull();
  });

  it("refuses once tickets have been sold", async () => {
    const { eventId } = await eventWithSale(300_000);
    const parsed = await parse(
      await DELETE_EVENT(req("DELETE", "/"), ctx({ id: eventId })),
    );
    // Deleting would take the buyers' tickets with it; cancelling is the move.
    expect(parsed.status).toBe(409);
    expect(errorCode(parsed)).toBe("CONFLICT");
  });

  it("refuses another workspace's owner", async () => {
    const { eventId } = await eventWithSale(0);
    await signInAs(NEGAR_OWNER);
    const parsed = await parse(
      await DELETE_EVENT(req("DELETE", "/"), ctx({ id: eventId })),
    );
    expect(parsed.status).toBe(403);
    await signInAs(AVA_OWNER);
  });

  it("404s an unknown event", async () => {
    const parsed = await parse(
      await DELETE_EVENT(req("DELETE", "/"), ctx({ id: "nope" })),
    );
    expect(parsed.status).toBe(404);
  });
});
