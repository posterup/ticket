/**
 * Discount redemption rules — pure functions over an already-fetched
 * {@link DiscountCode}.
 *
 * Deliberately free of any datastore access so the rules stay unit-testable
 * without a database. `lib/server/discounts/index.ts` does the lookup and
 * delegates the decision here.
 */

import type { DiscountCode, DiscountValidation, Money } from "@/types";

/** Codes are stored and compared upper-case and trimmed. */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/** The Toman amount a valid code removes from `subtotal` (never below zero). */
export function computeDiscountAmount(
  discount: DiscountCode,
  subtotal: Money,
): Money {
  const raw =
    discount.kind === "percent"
      ? Math.floor((subtotal * discount.value) / 100)
      : discount.value;
  return Math.max(0, Math.min(raw, subtotal));
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
  subtotal,
  now = Date.now(),
}: {
  rawCode: string;
  discount: DiscountCode | undefined;
  eventId: string;
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
  if (discount.expiresAt && new Date(discount.expiresAt).getTime() < now) {
    return { ok: false, reason: "مهلت استفاده از این کد به پایان رسیده است." };
  }
  if (
    discount.maxRedemptions !== null &&
    discount.redemptions >= discount.maxRedemptions
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
