/**
 * Discount-code data-access + validation over an in-memory array. Replace the
 * array operations with real queries when a datastore is added.
 *
 * ⚠️ Codes created via {@link createDiscount} live in a module-level array, so
 * on serverless they persist only within a single instance. Seeded codes are
 * always available for redemption.
 */

import type {
  CreateDiscountInput,
  DiscountCode,
  DiscountValidation,
  Money,
} from "@/types";

const CONCERT_EVENT = "3f1a6c2e-0001-4a10-9b21-1a2b3c4d5e01";

const discounts: DiscountCode[] = [
  {
    id: "dc100000-0000-4000-8000-000000000001",
    eventId: null,
    code: "WELCOME10",
    kind: "percent",
    value: 10,
    maxRedemptions: 100,
    redemptions: 23,
    expiresAt: null,
    active: true,
    createdAt: "2026-06-15T09:00:00.000Z",
  },
  {
    id: "dc100000-0000-4000-8000-000000000002",
    eventId: CONCERT_EVENT,
    code: "EARLY",
    kind: "fixed",
    value: 500_000,
    maxRedemptions: 200,
    redemptions: 148,
    expiresAt: "2026-08-01T20:30:00.000Z",
    active: true,
    createdAt: "2026-06-16T10:30:00.000Z",
  },
  {
    id: "dc100000-0000-4000-8000-000000000003",
    eventId: CONCERT_EVENT,
    code: "VIP20",
    kind: "percent",
    value: 20,
    maxRedemptions: 50,
    redemptions: 50,
    expiresAt: null,
    active: true,
    createdAt: "2026-06-18T12:00:00.000Z",
  },
];

/** Return discount codes, optionally scoped to a single event (plus org-wide). */
export function listDiscounts(eventId?: string): DiscountCode[] {
  if (eventId === undefined) return [...discounts];
  return discounts.filter((d) => d.eventId === null || d.eventId === eventId);
}

/** Create and persist a new discount code, returning the stored record. */
export function createDiscount(input: CreateDiscountInput): DiscountCode {
  const discount: DiscountCode = {
    id: crypto.randomUUID(),
    eventId: input.eventId,
    sessionId: input.sessionId ?? null,
    code: input.code.trim().toUpperCase(),
    kind: input.kind,
    value: input.value,
    maxRedemptions: input.maxRedemptions,
    redemptions: 0,
    expiresAt: input.expiresAt,
    active: true,
    createdAt: new Date().toISOString(),
  };
  discounts.push(discount);
  return discount;
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
 * Validate a redemption of `rawCode` against an order. Returns a discriminated
 * result carrying either the computed discount or a Persian failure reason.
 */
export function validateDiscount(
  rawCode: string,
  eventId: string,
  subtotal: Money,
): DiscountValidation {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, reason: "کد تخفیف را وارد کنید." };
  if (subtotal <= 0) return { ok: false, reason: "مبلغ سفارش نامعتبر است." };

  const discount = discounts.find((d) => d.code === code);
  if (!discount || !discount.active) {
    return { ok: false, reason: "کد تخفیف معتبر نیست." };
  }
  if (discount.eventId !== null && discount.eventId !== eventId) {
    return { ok: false, reason: "این کد برای این رویداد قابل استفاده نیست." };
  }
  if (discount.expiresAt && new Date(discount.expiresAt).getTime() < Date.now()) {
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
