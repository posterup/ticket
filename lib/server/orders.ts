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
  TicketDesign,
} from "@/types";

import { db } from "./db";
import { HttpError } from "./http";
import { checkDiscountEligibility, normalizeCode } from "./discounts/rules";
import { toDiscount } from "./mappers";
import { TICKET_STATUS_FROM_DB } from "./mappers/enums";
import {
  attachHoldsToOrder,
  priceSeatSelection,
  releaseOrderHolds,
  type PricedSeatLine,
} from "./venues/holds";
import { notifyOrderPaid } from "./notifications/order-paid";
import { normalizeMobile, phoneVariants } from "./sms";
import { notifyWaitlist } from "./waitlist";

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

  await releaseOrderHolds(stale.map((o) => o.id));

  await db.$transaction([
    ...stale.flatMap((order) =>
      order.items.map((item) =>
        db.ticketType.update({
          where: { id: item.ticketTypeId },
          data: { reserved: { decrement: item.quantity } },
        }),
      ),
    ),
    // A discount claim lapses with the order that took it. Without this a code
    // capped at one would be retired by the first buyer who wandered off at the
    // payment page — the cap enforced against nobody.
    //
    // Safe against double-release: the query selects only PENDING_PAYMENT
    // orders and this same transaction moves them to EXPIRED.
    ...stale
      .filter((order) => order.discountCodeId)
      .map((order) =>
        db.discountCode.update({
          where: { id: order.discountCodeId! },
          data: { reserved: { decrement: 1 } },
        }),
      ),
    db.order.updateMany({
      where: { id: { in: stale.map((o) => o.id) } },
      data: { status: "EXPIRED" },
    }),
  ]);

  // Inventory just came back. Tell the front of each affected queue — not
  // awaited, and `notifyWaitlist` never throws, so a slow SMS operator cannot
  // hold up the buyer whose purchase triggered this sweep.
  const freedByEvent = new Map<string, number>();
  for (const order of stale) {
    const seats = order.items.reduce((sum, i) => sum + i.quantity, 0);
    freedByEvent.set(order.eventId, (freedByEvent.get(order.eventId) ?? 0) + seats);
  }
  for (const [id, seats] of freedByEvent) void notifyWaitlist(id, seats);

  return stale.length;
}

/**
 * Return an order's assigned seats to sale and tell the waitlist.
 *
 * Exported because three call sites need it — cancellation, the expiry sweep,
 * and the payment callback — and each previously did its own bookkeeping. The
 * callback's copy never touched `SeatHold` at all, so a failed payment stranded
 * the seats for the full 20-minute hold TTL instead of releasing them.
 *
 * Deliberately does *not* touch `TicketType.reserved`: each caller already
 * adjusts that inside its own transaction, and doing it here too would
 * double-decrement.
 */
export async function releaseSeatInventory(orderId: string): Promise<void> {
  await releaseOrderHolds([orderId]);

  const [order, items] = await Promise.all([
    db.order.findUnique({ where: { id: orderId }, select: { eventId: true } }),
    db.orderItem.findMany({ where: { orderId }, select: { quantity: true } }),
  ]);
  if (!order || !items.length) return;

  void notifyWaitlist(
    order.eventId,
    items.reduce((sum, i) => sum + i.quantity, 0),
  );
}

/** Give back the seats an order was holding. Safe to call once per order. */
async function releaseHold(orderId: string): Promise<void> {
  await releaseSeatInventory(orderId);

  // The discount claim goes back with the seats. This is the cancel/failed-
  // payment path; the expiry sweep does the same thing in its own transaction.
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { discountCodeId: true },
  });
  if (order?.discountCodeId) await releaseDiscount(order.discountCodeId);

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
 * Claim one redemption of a discount code.
 *
 * The same shape as {@link reserve}, and there for the same reason: the
 * eligibility check in `checkDiscountEligibility` is a *read*, so between it
 * and the order's creation any number of other buyers can pass the identical
 * check. This is the statement that actually decides, under the row lock
 * Postgres takes for the UPDATE.
 *
 * An uncapped code (`maxRedemptions IS NULL`) still increments `reserved`, so
 * release paths need no special case — and the guard's `IS NULL` arm means it
 * can never refuse one.
 */
async function claimDiscount(discountCodeId: string): Promise<boolean> {
  const updated = await db.$executeRaw`
    UPDATE "DiscountCode"
       SET reserved = reserved + 1
     WHERE id = ${discountCodeId}
       AND ("maxRedemptions" IS NULL
            OR redemptions + reserved + 1 <= "maxRedemptions")
  `;
  return updated === 1;
}

/** Give a claimed redemption back — an order that lapsed, cancelled or failed. */
async function releaseDiscount(discountCodeId: string): Promise<void> {
  await db.$executeRaw`
    UPDATE "DiscountCode"
       SET reserved = GREATEST(0, reserved - 1)
     WHERE id = ${discountCodeId}
  `;
}

/**
 * Create an order, holding its seats.
 *
 * Prices are read from the database, never from the request: a client that
 * sends its own totals is describing what it would *like* to pay.
 */
export async function createOrder(
  input: CreateOrderInput,
  actor: { userId?: string; holderKey?: string } = {},
): Promise<{ order: Order; requiresPayment: boolean }> {
  await releaseExpiredOrders(input.eventId);

  /**
   * Assigned seating rewrites the request's line items.
   *
   * The client names seats; the section→TicketType mapping and the price come
   * from the database. Verifying the caller already holds every seat happens
   * here too — this is the last point at which the order can be refused
   * without having taken money.
   */
  let seatLines: PricedSeatLine[] = [];
  if (input.seats?.length) {
    if (!input.sessionId) {
      throw new HttpError(400, "INVALID_BODY", "برای صندلی شماره‌دار سانس لازم است.");
    }
    if (!actor.holderKey) {
      throw new HttpError(400, "INVALID_BODY", "نگه‌دارنده صندلی مشخص نیست.");
    }
    seatLines = await priceSeatSelection({
      eventId: input.eventId,
      sessionId: input.sessionId,
      selections: input.seats,
      holderKey: actor.holderKey,
    });
  }

  /**
   * Seats and plain quantities are merged, not chosen between.
   *
   * A venue can hold both at once — the arena fixture has four seated stands
   * around a 3,000-capacity standing floor — so a single basket may legitimately
   * contain "row K seats 46–48" *and* "three standing". Picking one shape over
   * the other made the standing floor unbuyable.
   *
   * Lines are merged by ticket type so two sections priced from the same tier
   * become one order line, and the capacity check that follows sees the true
   * total rather than two halves that each fit.
   */
  const merged = new Map<string, number>();
  for (const line of seatLines) {
    merged.set(
      line.ticketTypeId,
      (merged.get(line.ticketTypeId) ?? 0) + line.quantity,
    );
  }
  for (const item of input.items) {
    merged.set(
      item.ticketTypeId,
      (merged.get(item.ticketTypeId) ?? 0) + item.quantity,
    );
  }
  const requestedItems = [...merged.entries()].map(
    ([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }),
  );

  if (!requestedItems.length) {
    throw new HttpError(400, "INVALID_BODY", "سفارش خالی است.");
  }

  const event = await db.event.findUnique({
    where: { id: input.eventId },
    select: {
      id: true,
      status: true,
      workspaceId: true,
      requiresApproval: true,
      visibility: true,
      audienceTags: true,
    },
  });
  if (!event) throw new HttpError(404, "NOT_FOUND", "رویداد یافت نشد.");
  if (event.status !== "PUBLISHED") {
    throw new HttpError(409, "SALES_CLOSED", "فروش این رویداد فعال نیست.");
  }

  /**
   * The showing has to be real, ours, and open.
   *
   * None of this was checked. `sessionId` came straight off the request and was
   * written to the order, so a body naming *another event's* session produced a
   * paid order filed against a showing it had nothing to do with — which then
   * quietly poisoned everything scoped by session: the check-in holder list,
   * the refund queue, and the cancellation notices.
   *
   * Cancelled and «تکمیل ظرفیت» were unenforced for a plainer reason: nothing
   * ever read them. An organiser could call a showing off, or close its sales,
   * and buyers kept buying — and, having bought after the cancellation notice
   * went out, would never be told at all.
   *
   * `almost-full` stays buyable. It is an urgency hint the organiser sets to
   * sell *faster*; treating it as a stop would invert its meaning.
   */
  if (input.sessionId) {
    const session = await db.eventSession.findUnique({
      where: { id: input.sessionId },
      select: { eventId: true, cancelled: true, availability: true },
    });
    if (!session || session.eventId !== event.id) {
      throw new HttpError(404, "NOT_FOUND", "سانس انتخابی برای این رویداد نیست.");
    }
    if (session.cancelled) {
      throw new HttpError(409, "SALES_CLOSED", "این سانس لغو شده است.");
    }
    if (session.availability === "FULL") {
      throw new HttpError(409, "SOLD_OUT", "ظرفیت این سانس تکمیل شده است.");
    }
    if (session.availability === "SOON") {
      throw new HttpError(409, "SALES_CLOSED", "فروش این سانس هنوز آغاز نشده است.");
    }
  }

  /**
   * Approval gate.
   *
   * The public page routes these events to a join request rather than to
   * checkout, but the gate has to live here too — otherwise it is one crafted
   * POST away from being skipped, and the organiser's decision becomes
   * decorative.
   *
   * Matched on phone because checkout is open to guests: the request and the
   * order may come from someone who never signs in.
   */
  if (event.requiresApproval) {
    const accepted = await db.eventRegistration.findFirst({
      where: {
        eventId: event.id,
        status: "ACCEPTED",
        // Same reason as the audience gate below: registrations are written
        // with whatever the requester typed.
        phone: { in: phoneVariants(input.buyerPhone) },
      },
      select: { id: true },
    });
    if (!accepted) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        "این رویداد با تأیید میزبان است. ابتدا درخواست ثبت‌نام بدهید.",
      );
    }
  }

  /**
   * Audience gate.
   *
   * «مخاطبان هدف» was enforced on every path that *reads* an event and on none
   * that sells one: this function never selected `visibility`, so an event
   * restricted to a CRM segment was bought by anyone holding its `eventId` and
   * a `ticketTypeId`. The listing hid it and the checkout sold it.
   *
   * Matched on the buyer's phone for the same reason the approval gate above
   * is: checkout is open to guests, and demanding an account only here would
   * shut a door the platform leaves open everywhere else.
   *
   * Fails closed on an empty tag list, matching `inTargetAudience`. "Targeted
   * at nothing" is a misconfiguration, and reading it as "everyone" is the one
   * interpretation with consequences.
   */
  if (event.visibility === "AUDIENCE") {
    const inSegment =
      event.audienceTags.length > 0 &&
      (await db.attendee.findFirst({
        where: {
          workspaceId: event.workspaceId,
          // Every spelling — attendee phones are stored unnormalised, so
          // matching one form refuses people who are in the segment.
          phone: { in: phoneVariants(input.buyerPhone) },
          tags: { some: { tag: { label: { in: event.audienceTags } } } },
        },
        select: { id: true },
      })) !== null;

    if (!inSegment) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        "این رویداد فقط برای مخاطبان دعوت‌شده است.",
      );
    }
  }

  const types = await db.ticketType.findMany({
    where: {
      id: { in: requestedItems.map((i) => i.ticketTypeId) },
      eventId: event.id,
    },
  });
  if (types.length !== new Set(requestedItems.map((i) => i.ticketTypeId)).size) {
    throw new HttpError(400, "INVALID_BODY", "بلیت انتخاب‌شده معتبر نیست.");
  }

  const now = new Date();
  const priced = requestedItems.map((item) => {
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
    // Scoped to this event's workspace: codes are unique per workspace, and an
    // unscoped lookup let one organiser's workspace-wide code discount another
    // organiser's tickets.
    const row = code
      ? await db.discountCode.findFirst({
          where: { code, workspaceId: event.workspaceId },
        })
      : null;
    const verdict = checkDiscountEligibility({
      rawCode: input.discountCode,
      discount: row ? toDiscount(row) : undefined,
      eventId: event.id,
      sessionId: input.sessionId,
      subtotal,
    });
    if (!verdict.ok) {
      /**
       * A code that is simply full is not a malformed request, and the buyer
       * needs to be able to tell "this code is wrong" from "you were too late".
       * The atomic claim below raises the same code for the same condition, so
       * the pre-check and the race report one thing, not two.
       */
      const full =
        row !== null &&
        row.maxRedemptions !== null &&
        row.redemptions + row.reserved >= row.maxRedemptions;
      throw new HttpError(
        full ? 409 : 400,
        full ? "DISCOUNT_EXHAUSTED" : "INVALID_BODY",
        verdict.reason,
      );
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

  /**
   * Claim the discount only once the seats are actually in hand, so a sold-out
   * order never burns a redemption — and give the seats back if the code turns
   * out to have been taken while we were reserving them.
   */
  if (discountCodeId && !(await claimDiscount(discountCodeId))) {
    await db.$transaction(
      held.map((h) =>
        db.ticketType.update({
          where: { id: h.ticketTypeId },
          data: { reserved: { decrement: h.quantity } },
        }),
      ),
    );
    throw new HttpError(
      409,
      "DISCOUNT_EXHAUSTED",
      "ظرفیت استفاده از این کد تکمیل شده است.",
    );
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

  // Transfer, not re-check: the customer won the race when they picked the
  // seats. Once `orderId` is set the sweeper leaves the hold alone, so the
  // seats survive the trip to the payment gateway.
  if (seatLines.length && input.sessionId && actor.holderKey) {
    await attachHoldsToOrder({
      sessionId: input.sessionId,
      holderKey: actor.holderKey,
      orderId: row.id,
      seatIds: seatLines.flatMap((l) => l.seatIds),
    });
  }

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

  /**
   * Assigned seating: the order's holds name exactly which seats were bought.
   *
   * Grouped by ticket type so each issued ticket carries the seat it belongs
   * to. An order with no holds is unreserved seating and issues anonymous
   * tickets exactly as before.
   */
  const seatHolds = await db.seatHold.findMany({
    where: { orderId: row.id },
    orderBy: { seatId: "asc" },
    select: {
      seatId: true,
      sessionId: true,
      seat: { select: { section: { select: { id: true } } } },
    },
  });

  const seatQueue = new Map<string, string[]>();
  if (seatHolds.length) {
    const pricing = await db.sessionSectionPricing.findMany({
      where: { eventId: row.eventId },
      select: { sectionId: true, ticketTypeId: true },
    });
    const typeBySection = new Map(
      pricing.map((p) => [p.sectionId, p.ticketTypeId]),
    );
    for (const hold of seatHolds) {
      const typeId = typeBySection.get(hold.seat.section.id);
      if (!typeId) {
        /**
         * The section lost its pricing between the hold and the payment.
         *
         * `priceSeatSelection` refuses this at order time with a 409, so the
         * codebase already knows it happens — an organiser can delete a
         * `SessionSectionPricing` row inside the twenty minutes a hold lives.
         * By here the money has moved, and failing the transaction would leave
         * a settled payment with no tickets at all, which is strictly worse
         * than a ticket that is missing its seat number.
         *
         * So the seat is dropped from the queue and the ticket is issued
         * without it — but *loudly*. `seatStatus` below still marks the seat
         * sold, so the row exists with no ticket pointing at it, and someone
         * has to reconcile that by hand. Silently skipping left no trace that
         * a paid, seated order had come out unseated.
         */
        console.error(
          "[orders] no pricing for section at settlement; ticket issued without a seat",
          {
            orderId: row.id,
            code: row.code,
            seatId: hold.seatId,
            sectionId: hold.seat.section.id,
          },
        );
        continue;
      }
      const queue = seatQueue.get(typeId) ?? [];
      queue.push(hold.seatId);
      seatQueue.set(typeId, queue);
    }
  }

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
    // One ticket per seat, each with its own scannable token — and, for
    // assigned seating, the seat it admits to.
    db.ticket.createMany({
      data: row.items.flatMap((item) => {
        const queue = seatQueue.get(item.ticketTypeId) ?? [];
        return Array.from({ length: item.quantity }, (_, i) => ({
          id: randomUUID(),
          orderId: row.id,
          ticketTypeId: item.ticketTypeId,
          sessionId: row.sessionId,
          holderName: row.buyerName,
          holderPhone: row.buyerPhone,
          qrToken: qrToken(),
          seatId: queue[i],
        }));
      }),
    }),
    // Mark the seats sold. Sparse by design: this is the only row a sold seat
    // gets, and an unsold seat gets none.
    ...seatHolds.map((hold) =>
      db.seatStatus.create({
        data: {
          sessionId: hold.sessionId,
          seatId: hold.seatId,
          state: "SOLD",
          orderId: row.id,
        },
      }),
    ),
    // The hold has done its job; SeatStatus is now what keeps the seat off sale.
    db.seatHold.deleteMany({ where: { orderId: row.id } }),
  ]);

  // Confirmation goes out only once, on the transition that actually issued
  // the tickets — a duplicate gateway callback returns early above and so
  // cannot re-send. Not awaited: the buyer's redirect should not wait on an
  // SMS operator, and `notifyOrderPaid` never throws.
  void notifyOrderPaid(row.id);

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
    /**
     * One buyer, one contact — whatever they typed.
     *
     * This keyed the upsert on `row.buyerPhone` raw, and the zod schema accepts
     * `09…`, `+989…` and `989…` alike. So the same person buying twice, typing
     * their number differently, became **two** CRM contacts: tags applied to one
     * did not reach the other, segment counts double-counted them, and audience
     * targeting missed them from whichever row was not tagged. In a product
     * whose whole premise is that the attendee is the asset, that is the asset
     * quietly splitting in half.
     *
     * `waitlist.ts` had this right — it normalises before its upsert. Matching
     * that, with one addition: the variant lookup first, so rows already stored
     * in another spelling are found rather than duplicated. New contacts are
     * written normalised, so the problem stops growing.
     */
    const existing = await db.attendee.findFirst({
      where: {
        workspaceId: event.workspaceId,
        phone: { in: phoneVariants(row.buyerPhone) },
      },
      select: { id: true },
    });
    // Still an upsert when there is no match: two concurrent first-time orders
    // would otherwise race and one would hit the unique constraint.
    const contact =
      existing ??
      (await db.attendee.upsert({
        where: {
          workspaceId_phone: {
            workspaceId: event.workspaceId,
            phone: normalizeMobile(row.buyerPhone),
          },
        },
        create: {
          workspaceId: event.workspaceId,
          fullName: row.buyerName,
          phone: normalizeMobile(row.buyerPhone),
        },
        update: {},
        select: { id: true },
      }));
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
      // The claim taken at order creation *becomes* the redemption; it is moved
      // between the two counters, not added on top of one. Incrementing
      // `redemptions` without releasing `reserved` would charge the code twice
      // for one sale and retire it at half its stated capacity.
      db.discountCode.update({
        where: { id: row.discountCodeId },
        data: {
          redemptions: { increment: 1 },
          reserved: { decrement: 1 },
        },
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

/**
 * The tickets an order issued, for the order-result page.
 *
 * A guest buyer has no account, so this page is the *only* route they have to
 * their entry codes — the tracking code in their SMS is the credential. That
 * makes the code a bearer secret: eight characters from a 28-symbol alphabet
 * (~3.8e11 combinations), which is fine against online guessing but is why this
 * returns nothing until the order is actually paid.
 */
export async function ticketsForOrderCode(
  code: string,
): Promise<IssuedTicket[]> {
  const order = await db.order.findUnique({
    where: { code },
    select: { id: true, status: true },
  });
  if (!order || order.status !== "PAID") return [];

  const rows = await db.ticket.findMany({
    where: { orderId: order.id },
    include: {
      order: { select: { code: true } },
      ticketType: {
        select: {
          name: true,
          event: {
            select: {
              id: true,
              title: true,
              status: true,
              ticketDesign: true,
              venue: { select: { name: true } },
              sessions: { orderBy: { startAt: "asc" }, take: 1 },
            },
          },
        },
      },
      session: true,
      seat: {
        select: {
          label: true,
          row: { select: { label: true } },
          section: { select: { name: true } },
        },
      },
    },
    orderBy: { issuedAt: "asc" },
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
      endAt: when?.endAt.toISOString(),
      venueName: event.venue.name,
      issuedAt: t.issuedAt.toISOString(),
      seat: t.seat
        ? {
            section: t.seat.section.name,
            row: t.seat.row.label,
            number: t.seat.label,
          }
        : undefined,
      design: (event.ticketDesign as TicketDesign | null) ?? undefined,
      // Either the whole event was called off, or just this showing.
      showCancelled:
        event.status === "CANCELLED" || (when?.cancelled ?? false) || undefined,
    };
  });
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
              status: true,
              ticketDesign: true,
              venue: { select: { name: true } },
              sessions: { orderBy: { startAt: "asc" }, take: 1 },
            },
          },
        },
      },
      session: true,
      // A ticket without a seat is open seating; the relation stays null.
      seat: {
        select: {
          label: true,
          row: { select: { label: true } },
          section: { select: { name: true } },
        },
      },
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
      endAt: when?.endAt.toISOString(),
      venueName: event.venue.name,
      issuedAt: t.issuedAt.toISOString(),
      seat: t.seat
        ? {
            section: t.seat.section.name,
            row: t.seat.row.label,
            number: t.seat.label,
          }
        : undefined,
      design: (event.ticketDesign as TicketDesign | null) ?? undefined,
      // Either the whole event was called off, or just this showing.
      showCancelled:
        event.status === "CANCELLED" || (when?.cancelled ?? false) || undefined,
    };
  });
}
