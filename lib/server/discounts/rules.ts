/**
 * Discount redemption rules — pure functions over an already-fetched
 * {@link DiscountCode}.
 *
 * Deliberately free of any datastore access so the rules stay unit-testable
 * without a database. `lib/server/discounts/index.ts` does the lookup and
 * delegates the decision here.
 */

import { MIN_AMOUNT_TOMAN } from "@/lib/server/payments/zarinpal-codes";
import type { DiscountCode, DiscountValidation, Money } from "@/types";

/** Codes are stored and compared upper-case and trimmed. */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * The Toman amount a valid code removes from `subtotal`.
 *
 * **A discount never takes an order to zero.** The clamp used to be
 * `Math.min(raw, subtotal)`, so a `percent` code of 100 — or any fixed-amount
 * code worth at least the basket — landed on exactly nothing to pay. That is
 * not a discount, it is a giveaway issued by whoever typed the code, and the
 * order then skipped the gateway entirely and settled itself (`createOrder`
 * treats `total === 0` as already paid).
 *
 * The floor is the gateway's own: Zarinpal rejects anything under
 * {@link MIN_AMOUNT_TOMAN}, so leaving less than that payable would produce an
 * order that cannot be paid — a worse outcome than a slightly smaller discount.
 *
 * A subtotal already below the floor cannot be helped by clamping; the discount
 * comes out as zero and the gateway refuses the order on its own terms rather
 * than this inventing a second rule about it.
 *
 * Free tickets do not come through here at all: a free event has no checkout,
 * and a mixed event's free tier reaches `total === 0` by having no price, not
 * by being discounted.
 */
export function computeDiscountAmount(
  discount: DiscountCode,
  subtotal: Money,
): Money {
  const raw =
    discount.kind === "percent"
      ? Math.floor((subtotal * discount.value) / 100)
      : discount.value;
  const mostItMayRemove = subtotal - MIN_AMOUNT_TOMAN;
  return Math.max(0, Math.min(raw, mostItMayRemove));
}

/**
 * Decide whether a code may be redeemed against an order.
 *
 * `discount` is the record the caller looked up for {@link normalizeCode} of
 * `rawCode`, or `undefined` when no such code exists. `now` is injectable so
 * expiry can be tested without freezing the clock.
 */
export function checkDiscountEligibility({
  rawCode,
  discount,
  eventId,
  sessionId,
  subtotal,
  now = Date.now(),
}: {
  rawCode: string;
  discount: DiscountCode | undefined;
  eventId: string;
  /** The showing being bought, when the order names one. */
  sessionId?: string;
  subtotal: Money;
  now?: number;
}): DiscountValidation {
  if (!normalizeCode(rawCode)) {
    return { ok: false, reason: "کد تخفیف را وارد کنید." };
  }
  if (subtotal <= 0) {
    return { ok: false, reason: "مبلغ سفارش نامعتبر است." };
  }
  if (!discount || !discount.active) {
    return { ok: false, reason: "کد تخفیف معتبر نیست." };
  }
  if (discount.eventId !== null && discount.eventId !== eventId) {
    return { ok: false, reason: "این کد برای این رویداد قابل استفاده نیست." };
  }
  /**
   * Session scope.
   *
   * The dashboard lets an organiser pin a code to one سانس, stores it, and
   * shows it back as «یک سانس» — and nothing ever checked it, so a code meant
   * for a quiet Tuesday was accepted on the sold-out Friday.
   *
   * A scoped code with no session on the order is refused rather than allowed:
   * the organiser said "this showing", and an order that names no showing is
   * not it.
   */
  if (discount.sessionId != null && discount.sessionId !== sessionId) {
    return { ok: false, reason: "این کد برای این سانس قابل استفاده نیست." };
  }
  if (discount.expiresAt && new Date(discount.expiresAt).getTime() < now) {
    return { ok: false, reason: "مهلت استفاده از این کد به پایان رسیده است." };
  }
  /**
   * Capacity, counting the orders that have claimed the code but not yet paid.
   *
   * `redemptions` alone only moves at settlement, and the gap between placing
   * an order and paying for it is a gateway redirect plus however long a human
   * takes — so every buyer arriving in that window read the same stale count
   * and was let through. A code capped at one was redeemed by all of them.
   *
   * `reserved` is released when an order expires or is cancelled, so an
   * abandoned checkout does not retire the code.
   */
  if (
    discount.maxRedemptions !== null &&
    discount.redemptions + discount.reserved >= discount.maxRedemptions
  ) {
    return { ok: false, reason: "ظرفیت استفاده از این کد تکمیل شده است." };
  }

  const discountAmount = computeDiscountAmount(discount, subtotal);
  return {
    ok: true,
    code: discount.code,
    kind: discount.kind,
    value: discount.value,
    discountAmount,
    total: subtotal - discountAmount,
  };
}
