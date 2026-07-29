/**
 * Orders and ticket issuance.
 *
 * The load-bearing part is inventory. Two buyers racing for the last seat must
 * not both succeed, and the failure has to happen *before* either is sent to a
 * payment gateway — otherwise one of them pays for something that cannot be
 * fulfilled, which in Iran means a manual refund.
 *
 * So seats are reserved when the order is created, not when payment verifies,
 * and the reservation is a single conditional UPDATE rather than a read
 * followed by a write. Postgres serialises concurrent updates to the same row,
 * so the check and the increment cannot be interleaved.
 */

import { randomBytes, randomUUID } from "node:crypto";

import type {
  CreateOrderInput,
  IssuedTicket,
  Money,
  Order,
  OrderStatus,
} from "@/types";

import { db } from "./db";
import { HttpError } from "./http";
import { checkDiscountEligibility, normalizeCode } from "./discounts/rules";
import { toDiscount } from "./mappers";
import { TICKET_STATUS_FROM_DB } from "./mappers/enums";

/** How long an unpaid order holds its seats. */
const HOLD_MINUTES = 15;

const ORDER_STATUS_FROM_DB: Record<string, OrderStatus> = {
  PENDING_PAYMENT: "pending-payment",
  PAID: "paid",
  EXPIRED: "expired",
  FAILED: "failed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
};

/** Short, unambiguous tracking code. No vowels, so it cannot spell anything. */
function trackingCode(): string {
  const alphabet = "ACDEFGHJKLMNPQRTVWXYZ2346789";
  const bytes = randomBytes(8);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

function qrToken(): string {
  return randomBytes(32).toString("base64url");
}

type OrderRow = Awaited<ReturnType<typeof findOrderRow>>;

function findOrderRow(id: string) {
  return db.order.findUnique({
    where: { id },
    include: { items: { include: { ticketType: true } } },
  });
}

function toOrder(row: NonNullable<OrderRow>): Order {
  return {
    id: row.id,
    code: row.code,
    eventId: row.eventId,
    sessionId: row.sessionId ?? undefined,
    buyerName: row.buyerName,
    buyerPhone: row.buyerPhone,
    items: row.items.map((item) => ({
      id: item.id,
      ticketTypeId: item.ticketTypeId,
      ticketTypeName: item.ticketType.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    subtotal: row.subtotal,
    discountAmount: row.discountAmount,
    total: row.total,
    status: ORDER_STATUS_FROM_DB[row.status] ?? "failed",
    expiresAt: row.expiresAt.toISOString(),
    paidAt: row.paidAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Release seats held by orders whose hold has lapsed.
 *
 * Called at the top of {@link createOrder} rather than from a cron: on
 * serverless there is no long-lived process, and the moment anyone tries to buy
 * is exactly when stale holds matter.
 */
export async function releaseExpiredOrders(eventId?: string): Promise<number> {
  const stale = await db.order.findMany({
    where: {
      status: "PENDING_PAYMENT",
      expiresAt: { lt: new Date() },
      ...(eventId ? { eventId } : {}),
    },
    include: { items: true },
  });
  if (stale.length === 0) return 0;

  await db.$transaction([
    ...stale.flatMap((order) =>
      order.items.map((item) =>
        db.ticketType.update({
          where: { id: item.ticketTypeId },
          data: { reserved: { decrement: item.quantity } },
        }),
      ),
    ),
    db.order.updateMany({
      where: { id: { in: stale.map((o) => o.id) } },
      data: { status: "EXPIRED" },
    }),
  ]);
  return stale.length;
}

/** Give back the seats an order was holding. Safe to call once per order. */
async function releaseHold(orderId: string): Promise<void> {
  const items = await db.orderItem.findMany({ where: { orderId } });
  if (items.length === 0) return;
  await db.$transaction(
    items.map((item) =>
      db.ticketType.update({
        where: { id: item.ticketTypeId },
        data: { reserved: { decrement: item.quantity } },
      }),
    ),
  );
}

/**
 * Hold `quantity` seats of a ticket type.
 *
 * One statement: the capacity check and the increment happen together, under
 * the row lock Postgres takes for the UPDATE. Returns false when the seats are
 * not there — never a partial hold.
 */
async function reserve(ticketTypeId: string, quantity: number): Promise<boolean> {
  const updated = await db.$executeRaw`
    UPDATE "TicketType"
       SET reserved = reserved + ${quantity}
     WHERE id = ${ticketTypeId}
       AND sold + reserved + ${quantity} <= capacity
  `;
  return updated === 1;
}

/**
 * Create an order, holding its seats.
 *
 * Prices are read from the database, never from the request: a client that
 * sends its own totals is describing what it would *like* to pay.
 */
export async function createOrder(
  input: CreateOrderInput,
  actor: { userId?: string } = {},
): Promise<{ order: Order; requiresPayment: boolean }> {
  await releaseExpiredOrders(input.eventId);

  const event = await db.event.findUnique({
    where: { id: input.eventId },
    select: { id: true, status: true, workspaceId: true },
  });
  if (!event) throw new HttpError(404, "NOT_FOUND", "رویداد یافت نشد.");
  if (event.status !== "PUBLISHED") {
    throw new HttpError(409, "SALES_CLOSED", "فروش این رویداد فعال نیست.");
  }

  const types = await db.ticketType.findMany({
    where: { id: { in: input.items.map((i) => i.ticketTypeId) }, eventId: event.id },
  });
  if (types.length !== new Set(input.items.map((i) => i.ticketTypeId)).size) {
    throw new HttpError(400, "INVALID_BODY", "بلیت انتخاب‌شده معتبر نیست.");
  }

  const now = new Date();
  const priced = input.items.map((item) => {
    const type = types.find((t) => t.id === item.ticketTypeId)!;
    if (type.salesStartAt > now) {
      throw new HttpError(409, "SALES_CLOSED", `فروش «${type.name}» هنوز آغاز نشده است.`);
    }
    if (type.salesEndAt < now) {
      throw new HttpError(409, "SALES_CLOSED", `فروش «${type.name}» به پایان رسیده است.`);
    }
    return { ...item, unitPrice: type.price, name: type.name };
  });

  const subtotal: Money = priced.reduce(
    (sum, i) => sum + i.unitPrice * i.quantity,
    0,
  );

  // Discounts are re-validated server-side; the client's arithmetic is a hint.
  let discountAmount = 0;
  let discountCodeId: string | null = null;
  if (input.discountCode) {
    const code = normalizeCode(input.discountCode);
    const row = code ? await db.discountCode.findFirst({ where: { code } }) : null;
    const verdict = checkDiscountEligibility({
      rawCode: input.discountCode,
      discount: row ? toDiscount(row) : undefined,
      eventId: event.id,
      subtotal,
    });
    if (!verdict.ok) {
      throw new HttpError(400, "INVALID_BODY", verdict.reason);
    }
    discountAmount = verdict.discountAmount;
    discountCodeId = row!.id;
  }

  // Reserve in a deterministic order so two multi-item orders cannot deadlock
  // by locking the same rows in opposite sequences.
  const ordered = [...priced].sort((a, b) =>
    a.ticketTypeId.localeCompare(b.ticketTypeId),
  );
  const held: typeof ordered = [];
  for (const item of ordered) {
    if (await reserve(item.ticketTypeId, item.quantity)) {
      held.push(item);
      continue;
    }
    // Roll back whatever this attempt already took before failing.
    await db.$transaction(
      held.map((h) =>
        db.ticketType.update({
          where: { id: h.ticketTypeId },
          data: { reserved: { decrement: h.quantity } },
        }),
      ),
    );
    throw new HttpError(409, "SOLD_OUT", `ظرفیت «${item.name}» تکمیل شده است.`);
  }

  const total = Math.max(0, subtotal - discountAmount);
  const row = await db.order.create({
    data: {
      code: trackingCode(),
      eventId: event.id,
      sessionId: input.sessionId,
      userId: actor.userId,
      buyerName: input.buyerName,
      buyerPhone: input.buyerPhone,
      subtotal,
      discountAmount,
      total,
      discountCodeId,
      expiresAt: new Date(Date.now() + HOLD_MINUTES * 60 * 1000),
      items: {
        create: priced.map((i) => ({
          ticketTypeId: i.ticketTypeId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      },
    },
    include: { items: { include: { ticketType: true } } },
  });

  // A free order has nothing to pay, so it settles immediately rather than
  // being sent to a gateway that would reject a zero amount.
  if (total === 0) {
    const paid = await markOrderPaid(row.id, { provider: "free" });
    return { order: paid, requiresPayment: false };
  }

  return { order: toOrder(row), requiresPayment: true };
}

/**
 * Settle an order and issue its tickets.
 *
 * Idempotent by construction: the status transition is a conditional UPDATE, so
 * a second call — a duplicate gateway callback, or a buyer using the back
 * button — finds nothing to change and returns the existing order rather than
 * issuing a second set of tickets.
 */
export async function markOrderPaid(
  orderId: string,
  payment: { provider: string; authority?: string; refId?: string },
): Promise<Order> {
  const claimed = await db.order.updateMany({
    where: { id: orderId, status: "PENDING_PAYMENT" },
    data: { status: "PAID", paidAt: new Date() },
  });

  const row = await findOrderRow(orderId);
  if (!row) throw new HttpError(404, "NOT_FOUND", "سفارش یافت نشد.");

  // Someone else already settled it; their tickets stand.
  if (claimed.count === 0) return toOrder(row);

  const event = await db.event.findUnique({
    where: { id: row.eventId },
    select: { workspaceId: true },
  });

  await db.$transaction([
    // Move the hold into a sale.
    ...row.items.map((item) =>
      db.ticketType.update({
        where: { id: item.ticketTypeId },
        data: {
          sold: { increment: item.quantity },
          reserved: { decrement: item.quantity },
        },
      }),
    ),
    // One ticket per seat, each with its own scannable token.
    db.ticket.createMany({
      data: row.items.flatMap((item) =>
        Array.from({ length: item.quantity }, () => ({
          id: randomUUID(),
          orderId: row.id,
          ticketTypeId: item.ticketTypeId,
          sessionId: row.sessionId,
          holderName: row.buyerName,
          holderPhone: row.buyerPhone,
          qrToken: qrToken(),
        })),
      ),
    }),
  ]);

  // `/pay` already recorded this attempt when it redirected the buyer, and
  // `authority` is unique — so settle that row rather than inserting a second.
  const attempt = payment.authority
    ? await db.payment.findUnique({
        where: { authority: payment.authority },
        select: { id: true },
      })
    : null;

  if (attempt) {
    await db.payment.update({
      where: { id: attempt.id },
      data: {
        status: "VERIFIED",
        refId: payment.refId,
        verifiedAt: new Date(),
      },
    });
  } else {
    await db.payment.create({
      data: {
        orderId: row.id,
        provider: payment.provider,
        amount: row.total,
        authority: payment.authority,
        refId: payment.refId,
        status: "VERIFIED",
        verifiedAt: new Date(),
      },
    });
  }

  // The buyer becomes a CRM contact of the organising workspace — this is the
  // moment a sale turns into a relationship.
  if (event) {
    const contact = await db.attendee.upsert({
      where: {
        workspaceId_phone: {
          workspaceId: event.workspaceId,
          phone: row.buyerPhone,
        },
      },
      create: {
        workspaceId: event.workspaceId,
        fullName: row.buyerName,
        phone: row.buyerPhone,
      },
      update: {},
      select: { id: true },
    });
    await db.order.update({
      where: { id: row.id },
      data: { attendeeId: contact.id },
    });
  }

  // Redemption is recorded once per order, which is what finally makes
  // `DiscountCode.redemptions` a real number.
  if (row.discountCodeId && row.discountAmount > 0) {
    await db.$transaction([
      db.discountRedemption.create({
        data: {
          discountCodeId: row.discountCodeId,
          orderId: row.id,
          amount: row.discountAmount,
        },
      }),
      db.discountCode.update({
        where: { id: row.discountCodeId },
        data: { redemptions: { increment: 1 } },
      }),
    ]);
  }

  return toOrder((await findOrderRow(orderId))!);
}

/** Abandon an order and give its seats back. */
export async function cancelOrder(orderId: string): Promise<Order | undefined> {
  const claimed = await db.order.updateMany({
    where: { id: orderId, status: "PENDING_PAYMENT" },
    data: { status: "CANCELLED" },
  });
  if (claimed.count > 0) await releaseHold(orderId);

  const row = await findOrderRow(orderId);
  return row ? toOrder(row) : undefined;
}

export async function getOrderById(id: string): Promise<Order | undefined> {
  const row = await findOrderRow(id);
  return row ? toOrder(row) : undefined;
}

/** Look up by the code shown to the buyer, for the order-result page. */
export async function getOrderByCode(code: string): Promise<Order | undefined> {
  const found = await db.order.findUnique({
    where: { code },
    select: { id: true },
  });
  return found ? getOrderById(found.id) : undefined;
}

/** A user's own orders, newest first. */
export async function listOrdersByUser(userId: string): Promise<Order[]> {
  const rows = await db.order.findMany({
    where: { userId },
    include: { items: { include: { ticketType: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toOrder);
}

/** A user's issued tickets — the "my tickets" surface that never existed. */
export async function listTicketsByUser(
  userId: string,
): Promise<IssuedTicket[]> {
  const rows = await db.ticket.findMany({
    where: { order: { userId, status: "PAID" } },
    include: {
      order: { select: { code: true } },
      ticketType: {
        select: {
          name: true,
          event: {
            select: {
              id: true,
              title: true,
              venue: { select: { name: true } },
              sessions: { orderBy: { startAt: "asc" }, take: 1 },
            },
          },
        },
      },
      session: true,
    },
    orderBy: { issuedAt: "desc" },
  });

  return rows.map((t) => {
    const event = t.ticketType.event;
    const when = t.session ?? event.sessions[0];
    return {
      id: t.id,
      orderId: t.orderId,
      orderCode: t.order.code,
      eventId: event.id,
      eventTitle: event.title,
      ticketTypeName: t.ticketType.name,
      holderName: t.holderName,
      qrToken: t.qrToken,
      status: TICKET_STATUS_FROM_DB[t.status],
      startAt: when?.startAt.toISOString(),
      venueName: event.venue.name,
      issuedAt: t.issuedAt.toISOString(),
    };
  });
}
